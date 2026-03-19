import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import {
  MockRedisClient,
  MockRedisService,
} from '../src/session/testing/mock-redis-client';

describe('Throttle guard (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const redisService = new MockRedisService(new MockRedisClient());
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 429 after 10 requests to POST /chat/session', async () => {
    const server = app.getHttpServer();

    // Send 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const res = await request(server).post('/chat/session');
      expect(res.status).toBe(201);
    }

    // 11th request should be throttled
    const res = await request(server).post('/chat/session');
    expect(res.status).toBe(429);
  });

  it('should NOT throttle the /health endpoint', async () => {
    const server = app.getHttpServer();

    // Send 15 requests — all should succeed because health is excluded
    for (let i = 0; i < 15; i++) {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
    }
  });
});
