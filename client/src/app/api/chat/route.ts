import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '../client';

const API_URL = process.env['API_URL'] ?? '';
const RATE_LIMIT_COOKIE_NAME = 'chatRateLimit';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

interface RateLimitCookieValue {
  sid: string;
  hits: number[];
}

function decodeRateLimitCookie(value?: string): RateLimitCookieValue | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as {
      sid?: unknown;
      hits?: unknown;
    };
    if (typeof parsed.sid !== 'string' || !Array.isArray(parsed.hits)) {
      return null;
    }
    const hits = parsed.hits.filter(
      (hit): hit is number => typeof hit === 'number' && Number.isFinite(hit),
    );
    return { sid: parsed.sid, hits };
  } catch {
    return null;
  }
}

function encodeRateLimitCookie(value: RateLimitCookieValue): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function getWindowHits(hits: number[], now: number): number[] {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  return hits.filter((hit) => hit > windowStart);
}

export async function POST(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (!sessionId) {
    return NextResponse.json({ sessionExpired: true }, { status: 401 });
  }

  const now = Date.now();
  const storedRateLimit = decodeRateLimitCookie(
    cookieStore.get(RATE_LIMIT_COOKIE_NAME)?.value,
  );
  const activeHits = getWindowHits(
    storedRateLimit?.sid === sessionId ? storedRateLimit.hits : [],
    now,
  );

  if (activeHits.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestHit = activeHits[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestHit + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    cookieStore.set(
      RATE_LIMIT_COOKIE_NAME,
      encodeRateLimitCookie({ sid: sessionId, hits: activeHits }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: RATE_LIMIT_WINDOW_SECONDS,
      },
    );
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      },
    );
  }

  const nextHits = [...activeHits, now];
  cookieStore.set(
    RATE_LIMIT_COOKIE_NAME,
    encodeRateLimitCookie({ sid: sessionId, hits: nextHits }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: RATE_LIMIT_WINDOW_SECONDS,
    },
  );

  let body: { message: string };
  try {
    body = (await req.json()) as { message: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const client = new ApiClient(API_URL);
    const nestRes = await client.requestRaw(
      `/chat/${sessionId}/message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body.message }),
        cache: 'no-store',
      },
    );

    // Handle 404/410 — session expired or not found
    if (nestRes.status === 404 || nestRes.status === 410) {
      cookieStore.delete('sessionId');
      cookieStore.delete(RATE_LIMIT_COOKIE_NAME);
      return NextResponse.json({ sessionExpired: true }, { status: nestRes.status });
    }

    // Handle 429 — rate-limited
    if (nestRes.status === 429) {
      const retryAfter = nestRes.headers.get('Retry-After');
      const headers: Record<string, string> = {};
      if (retryAfter) headers['Retry-After'] = retryAfter;
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429, headers },
      );
    }

    if (!nestRes.ok) {
      const errorData = (await nestRes.json().catch(() => ({}))) as Record<string, unknown>;
      return NextResponse.json(
        { error: (errorData['message'] as string) ?? 'Server error' },
        { status: nestRes.status },
      );
    }

    // Pipe the SSE stream through to the client
    if (!nestRes.body) {
      return NextResponse.json({ error: 'No stream body' }, { status: 500 });
    }

    return new Response(nestRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Connection lost, please retry.' },
      { status: 502 },
    );
  }
}
