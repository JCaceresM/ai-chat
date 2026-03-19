import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller.js';
import { SessionService } from '../session/session.service.js';
import { LlmService } from '../llm/llm.service.js';
import { DateProvider } from '../session/date.provider.js';
import { NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, SSE_METADATA } from '@nestjs/common/constants';
import type { MessageEvent } from '@nestjs/common';
import { lastValueFrom, Observable, toArray } from 'rxjs';
import { RedisService } from '../redis/redis.service.js';
import {
  MockRedisClient,
  MockRedisService,
} from '../session/testing/mock-redis-client.js';

describe('ChatController', () => {
  let controller: ChatController;
  let sessionService: SessionService;
  let llmService: LlmService;

  beforeEach(async () => {
    const redisClient = new MockRedisClient();
    const redisService = new MockRedisService(redisClient);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        SessionService,
        DateProvider,
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: LlmService,
          useValue: {
            streamResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    sessionService = module.get<SessionService>(SessionService);
    llmService = module.get<LlmService>(LlmService);
  });

  /** Collect all MessageEvents emitted by the Observable */
  async function collectEvents(
    observablePromise: Promise<Observable<MessageEvent>>,
  ): Promise<MessageEvent[]> {
    const observable = await observablePromise;
    return lastValueFrom(observable.pipe(toArray()));
  }

  describe('POST /chat/session', () => {
    it('should create a session and return 201 with sessionId', async () => {
      const result = await controller.createSession();
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('POST /chat/:sessionId/message', () => {
    it('should register the message route as POST + SSE', () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        ChatController.prototype,
        'sendMessage',
      );
      const handler = descriptor?.value as
        | ((...args: unknown[]) => unknown)
        | undefined;
      expect(handler).toBeDefined();

      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(SSE_METADATA, handler)).toBe(true);
    });

    it('should return an Observable that emits token and done events', async () => {
      const session = await sessionService.create();

      async function* mockStream() {
        await Promise.resolve();
        yield { token: 'Hello' };
        yield { token: ' World' };
      }

      const streamResponseSpy = jest
        .spyOn(llmService, 'streamResponse')
        .mockReturnValue(mockStream());

      const events = await collectEvents(
        controller.sendMessage(session.id, { message: 'Hi' }),
      );

      // Should have token events + done event
      expect(events.length).toBeGreaterThanOrEqual(3);

      const tokenEvents = events.filter(
        (e) => (e.data as Record<string, unknown>)['token'],
      );
      expect(tokenEvents).toHaveLength(2);
      expect((tokenEvents[0].data as Record<string, unknown>)['token']).toBe(
        'Hello',
      );
      expect((tokenEvents[1].data as Record<string, unknown>)['token']).toBe(
        ' World',
      );

      const doneEvent = events.find(
        (e) => (e.data as Record<string, unknown>)['done'],
      );
      expect(doneEvent).toBeDefined();
      expect((doneEvent!.data as Record<string, unknown>)['done']).toBe(true);
      expect((doneEvent!.data as Record<string, unknown>)['turnIndex']).toBe(1);
      expect(streamResponseSpy).toHaveBeenCalledWith({
        history: [],
        newMessage: 'Hi',
      });
      await expect(sessionService.getTurns(session.id)).resolves.toHaveLength(
        2,
      );
    });

    it('should not persist a partial reply when the stream fails', async () => {
      const session = await sessionService.create();

      async function* mockStream() {
        await Promise.resolve();
        yield { token: 'Partial reply' };
        yield { error: 'LLM unavailable' };
      }

      jest.spyOn(llmService, 'streamResponse').mockReturnValue(mockStream());

      const events = await collectEvents(
        controller.sendMessage(session.id, { message: 'Hi' }),
      );

      const errorEvent = events.find(
        (e) => (e.data as Record<string, unknown>)['error'],
      );
      const doneEvent = events.find(
        (e) => (e.data as Record<string, unknown>)['done'],
      );

      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as Record<string, unknown>)['error']).toBe(
        'LLM unavailable',
      );
      expect(doneEvent).toBeUndefined();
      await expect(sessionService.getTurns(session.id)).resolves.toHaveLength(
        0,
      );
    });

    it('should throw NotFoundException for unknown session', async () => {
      await expect(
        controller.sendMessage('nonexistent-id', { message: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when session key no longer exists', async () => {
      const session = await sessionService.create();
      await sessionService.delete(session.id);

      await expect(
        controller.sendMessage(session.id, { message: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /chat/:sessionId/history', () => {
    it('should return session history', async () => {
      const session = await sessionService.create();
      await sessionService.addTurn(session.id, 'Hello', 'Hi there');

      const result = await controller.getHistory(session.id);
      expect(result.sessionId).toBe(session.id);
      expect(result.turns).toHaveLength(2);
    });

    it('should throw NotFoundException for unknown session', async () => {
      await expect(controller.getHistory('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('DELETE /chat/:sessionId', () => {
    it('should delete the session', async () => {
      const session = await sessionService.create();
      await controller.deleteSession(session.id);
      await expect(sessionService.get(session.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
