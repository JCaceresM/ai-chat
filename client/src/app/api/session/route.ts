import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import ApiClient, { ApiError } from '../client';

const API_URL = process.env['API_URL'] ?? '';

export async function POST(): Promise<NextResponse> {
  try {
    const client = new ApiClient(API_URL);
    const data = await client.request<{ sessionId: string }>('/chat/session', {
      method: 'POST',
    });

    const cookieStore = await cookies();
    cookieStore.set('sessionId', data.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 30, // 30 minutes
    });
    return NextResponse.json({ sessionId: data.sessionId }, { status: 201 });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status },
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  cookieStore.delete('sessionId');

  if (sessionId) {
    try {
      const client = new ApiClient(API_URL);
      await client.request(`/chat/${sessionId}`, {
        method: 'DELETE',
      });
    } catch {
      // Clearing the browser cookie is the only requirement for session reset.
    }
  }

  return NextResponse.json({ ok: true });
}
