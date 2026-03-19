import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DateProvider } from './date.provider.js';
import { SessionService, SESSION_TTL_SECONDS } from './session.service.js';
import type { RedisService } from '../redis/redis.service.js';
import {
  MockRedisClient,
  MockRedisService,
} from './testing/mock-redis-client.js';

function getSessionKey(sessionId: string): string {
  return `chat:session:${sessionId}`;
}

describe('SessionService (Redis)', () => {
  let service: SessionService;
  let dateProvider: DateProvider;
  let redisClient: MockRedisClient;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1700000000000;
    dateProvider = new DateProvider();
    jest.spyOn(dateProvider, 'now').mockImplementation(() => currentTime);
    redisClient = new MockRedisClient();
    const redisService = new MockRedisService(redisClient);
    service = new SessionService(
      dateProvider,
      redisService as unknown as RedisService,
    );
  });

  describe('create', () => {
    it('should create a session with UUID and persist with TTL', async () => {
      const session = await service.create();

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(session.turns).toEqual([]);
      expect(session.createdAt).toBe(currentTime);
      expect(session.lastAccessedAt).toBe(currentTime);

      const key = getSessionKey(session.id);
      expect(redisClient.getStoredValue(key)).toBeDefined();
      expect(redisClient.getLastSetOptions(key)).toEqual({
        EX: SESSION_TTL_SECONDS,
        NX: true,
      });
    });

    it('should create unique sessions', async () => {
      const session1 = await service.create();
      const session2 = await service.create();
      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('get', () => {
    it('should retrieve an existing session and refresh lastAccessedAt + TTL', async () => {
      const created = await service.create();
      currentTime += 5000;

      const retrieved = await service.get(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.lastAccessedAt).toBe(currentTime);
      expect(redisClient.getLastSetOptions(getSessionKey(created.id))).toEqual({
        EX: SESSION_TTL_SECONDS,
      });
    });

    it('should throw NotFoundException for unknown session', async () => {
      await expect(service.get('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should treat expired/missing key as NotFoundException', async () => {
      const session = await service.create();
      await redisClient.del(getSessionKey(session.id));

      await expect(service.get(session.id)).rejects.toThrow(NotFoundException);
    });

    it('should delete malformed session payload and throw NotFoundException', async () => {
      const session = await service.create();
      await redisClient.set(getSessionKey(session.id), 'invalid-json');

      await expect(service.get(session.id)).rejects.toThrow(NotFoundException);
      expect(
        redisClient.getStoredValue(getSessionKey(session.id)),
      ).toBeUndefined();
    });
  });

  describe('addTurn', () => {
    it('should add user and assistant turns', async () => {
      const session = await service.create();
      const turns = await service.addTurn(session.id, 'Hello', 'Hi there!');
      expect(turns).toHaveLength(2);
      expect(turns[0]).toMatchObject({ role: 'user', content: 'Hello' });
      expect(turns[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should accumulate turns', async () => {
      const session = await service.create();
      await service.addTurn(session.id, 'First', 'First reply');
      const turns = await service.addTurn(session.id, 'Second', 'Second reply');
      expect(turns).toHaveLength(4);
    });
  });

  describe('getTurns', () => {
    it('should return empty array for new session', async () => {
      const session = await service.create();
      await expect(service.getTurns(session.id)).resolves.toEqual([]);
    });

    it('should return all turns', async () => {
      const session = await service.create();
      await service.addTurn(session.id, 'Hello', 'Hi');
      const turns = await service.getTurns(session.id);
      expect(turns).toHaveLength(2);
    });
  });

  describe('getTurnCount', () => {
    it('should return 0 for new session', async () => {
      const session = await service.create();
      await expect(service.getTurnCount(session.id)).resolves.toBe(0);
    });

    it('should return number of conversation turns', async () => {
      const session = await service.create();
      await service.addTurn(session.id, 'Hello', 'Hi');
      await service.addTurn(session.id, 'How?', 'Good');
      await expect(service.getTurnCount(session.id)).resolves.toBe(2);
    });
  });

  describe('delete', () => {
    it('should delete an existing session', async () => {
      const session = await service.create();
      await service.delete(session.id);
      await expect(service.get(session.id)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown session', async () => {
      await expect(service.delete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('appendUserTurn / appendAssistantTurn', () => {
    it('should append individual turns', async () => {
      const session = await service.create();
      await service.appendUserTurn(session.id, 'Hello');
      await service.appendAssistantTurn(session.id, 'Hi');
      const turns = await service.getTurns(session.id);
      expect(turns).toHaveLength(2);
      expect(turns[0].role).toBe('user');
      expect(turns[1].role).toBe('assistant');
    });
  });

  describe('optimistic concurrency', () => {
    it('should retry once when EXEC returns conflict', async () => {
      const session = await service.create();
      redisClient.forceConflictOnce();

      const turns = await service.addTurn(session.id, 'Hello', 'Hi');
      expect(turns).toHaveLength(2);
      expect(turns[1]?.content).toBe('Hi');
    });

    it('should fail after 3 conflicts', async () => {
      const session = await service.create();
      redisClient.forceConflictOnce();
      redisClient.forceConflictOnce();
      redisClient.forceConflictOnce();

      await expect(service.addTurn(session.id, 'Hello', 'Hi')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
