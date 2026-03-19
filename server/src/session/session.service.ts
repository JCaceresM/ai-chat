import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Session, Turn } from './session.types.js';
import { DateProvider } from './date.provider.js';
import { RedisService } from '../redis/redis.service.js';

export const SESSION_TTL_SECONDS = 30 * 60;
const SESSION_KEY_PREFIX = 'chat:session:';
const MAX_WATCH_RETRIES = 3;

interface SessionRedisSetOptions {
  EX?: number;
  NX?: boolean;
}

interface SessionRedisMulti {
  set(
    key: string,
    value: string,
    options?: SessionRedisSetOptions,
  ): SessionRedisMulti;
  exec(): Promise<unknown[] | null>;
}

interface SessionRedisClient {
  watch(...keys: string[]): Promise<'OK'>;
  unwatch(): Promise<'OK'>;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: SessionRedisSetOptions,
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  multi(): SessionRedisMulti;
}

@Injectable()
export class SessionService {
  private readonly redis: SessionRedisClient;

  constructor(
    private readonly dateProvider: DateProvider,
    redisService: RedisService,
  ) {
    this.redis = redisService.getClient() as unknown as SessionRedisClient;
  }

  async create(): Promise<Session> {
    const now = this.dateProvider.now();
    const session: Session = {
      id: randomUUID(),
      turns: [],
      createdAt: now,
      lastAccessedAt: now,
    };
    const key = this.getSessionKey(session.id);
    const status = await this.redis.set(key, this.serializeSession(session), {
      EX: SESSION_TTL_SECONDS,
      NX: true,
    });
    if (status !== 'OK') {
      throw new ServiceUnavailableException('Failed to create chat session.');
    }
    return this.cloneSession(session);
  }

  async get(sessionId: string): Promise<Session> {
    return this.withSessionMutation(sessionId, (session) =>
      this.cloneSession(session),
    );
  }

  async addTurn(
    sessionId: string,
    userMessage: string,
    assistantReply: string,
  ): Promise<Turn[]> {
    return this.withSessionMutation(sessionId, (session, now) => {
      session.turns.push(
        { role: 'user', content: userMessage, timestamp: now },
        { role: 'assistant', content: assistantReply, timestamp: now },
      );
      return session.turns.map((turn) => ({ ...turn }));
    });
  }

  async getTurns(sessionId: string): Promise<Turn[]> {
    return this.withSessionMutation(sessionId, (session) =>
      session.turns.map((turn) => ({ ...turn })),
    );
  }

  async getTurnCount(sessionId: string): Promise<number> {
    return this.withSessionMutation(sessionId, (session) =>
      Math.floor(session.turns.length / 2),
    );
  }

  async delete(sessionId: string): Promise<void> {
    const deleted = await this.redis.del(this.getSessionKey(sessionId));
    if (deleted === 0) {
      throw new NotFoundException(`Session ${sessionId} not found.`);
    }
  }

  async appendUserTurn(sessionId: string, message: string): Promise<void> {
    await this.withSessionMutation(sessionId, (session, now) => {
      session.turns.push({ role: 'user', content: message, timestamp: now });
    });
  }

  async appendAssistantTurn(sessionId: string, reply: string): Promise<void> {
    await this.withSessionMutation(sessionId, (session, now) => {
      session.turns.push({ role: 'assistant', content: reply, timestamp: now });
    });
  }

  private async withSessionMutation<T>(
    sessionId: string,
    mutator: (session: Session, now: number) => T,
  ): Promise<T> {
    const key = this.getSessionKey(sessionId);

    for (let attempt = 0; attempt < MAX_WATCH_RETRIES; attempt += 1) {
      await this.redis.watch(key);

      const storedSession = await this.redis.get(key);
      if (!storedSession) {
        await this.redis.unwatch();
        throw new NotFoundException(`Session ${sessionId} not found.`);
      }

      const parsed = this.deserializeSession(storedSession);
      if (!parsed) {
        await this.redis.unwatch();
        await this.redis.del(key);
        throw new NotFoundException(`Session ${sessionId} not found.`);
      }

      const session = this.cloneSession(parsed);
      const now = this.dateProvider.now();
      session.lastAccessedAt = now;
      const result = mutator(session, now);

      const tx = this.redis.multi();
      tx.set(key, this.serializeSession(session), { EX: SESSION_TTL_SECONDS });
      const execResult = await tx.exec();
      if (execResult !== null) {
        return result;
      }
    }

    throw new ServiceUnavailableException(
      'Concurrent session update conflict.',
    );
  }

  private getSessionKey(sessionId: string): string {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }

  private serializeSession(session: Session): string {
    return JSON.stringify(session);
  }

  private deserializeSession(raw: string): Session | null {
    try {
      const parsed = JSON.parse(raw) as Partial<Session>;
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.id !== 'string') return null;
      if (typeof parsed.createdAt !== 'number') return null;
      if (typeof parsed.lastAccessedAt !== 'number') return null;
      if (!Array.isArray(parsed.turns)) return null;

      const turns: Turn[] = [];
      for (const turn of parsed.turns) {
        if (!turn || typeof turn !== 'object') return null;
        const role = (turn as Partial<Turn>).role;
        const content = (turn as Partial<Turn>).content;
        const timestamp = (turn as Partial<Turn>).timestamp;
        if (role !== 'user' && role !== 'assistant') return null;
        if (typeof content !== 'string') return null;
        if (typeof timestamp !== 'number') return null;
        turns.push({ role, content, timestamp });
      }

      return {
        id: parsed.id,
        turns,
        createdAt: parsed.createdAt,
        lastAccessedAt: parsed.lastAccessedAt,
      };
    } catch {
      return null;
    }
  }

  private cloneSession(session: Session): Session {
    return {
      id: session.id,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      turns: session.turns.map((turn) => ({ ...turn })),
    };
  }
}
