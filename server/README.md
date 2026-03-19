# Server

NestJS backend for the Department Assistant. It creates chat sessions, stores history in Redis, streams assistant replies over SSE, and exposes Swagger documentation for the API.

## Responsibilities

- Create and delete chat sessions
- Fetch stored conversation history
- Stream assistant replies for `POST /chat/:sessionId/message`
- Persist sessions in Redis with idle expiry refresh
- Expose health and Swagger endpoints

## Prerequisites

- Node.js 20+
- pnpm
- Redis running on `redis://localhost:6379`
- A Gemini API key

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Configure these values:

- `LLM_API_KEY` required
- `LLM_MODEL` optional and fully configurable
- `PORT=3000`
- `FRONTEND_URL=http://localhost:3001`
- `REDIS_URL=redis://localhost:6379`

## Run Locally

```bash
pnpm install
pnpm run start:dev
```

The API will be available at `http://localhost:3000`.

## URLs

- API base: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs/swagger`
- Health: `http://localhost:3000/health`

## API Endpoints

- `POST /chat/session`
- `POST /chat/:sessionId/message`
- `GET /chat/:sessionId/history`
- `DELETE /chat/:sessionId`
- `GET /health`

## Available Scripts

- `pnpm run start:dev` starts the NestJS server in watch mode
- `pnpm run build` builds the production output
- `pnpm run start:prod` runs the built server
- `pnpm test` runs unit tests
- `pnpm run test:e2e` runs end-to-end tests
- `pnpm run lint` runs ESLint with auto-fix enabled by the script definition
