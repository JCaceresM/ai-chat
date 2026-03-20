# Department Assistant

Department Assistant is a multi-turn chat application with a Next.js client, a NestJS API, Redis-backed sessions, and Gemini-powered responses. The frontend uses a small BFF layer so the browser never calls the backend API directly.

## Architecture

```text
Browser
  -> Next.js client and BFF routes (/api/session, /api/chat)
  -> NestJS API
  -> Redis + Gemini
```

- The browser renders the chat UI from the Next.js app on `http://localhost:3001`.
- Next.js route handlers proxy session and message requests to the NestJS API on `http://localhost:3000`.
- Redis stores chat sessions with idle expiry.
- The backend streams assistant responses over SSE.

## Service URLs

- Client: `http://localhost:3001`
- Server: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/v1/docs/swagger`
- Health: `http://localhost:3000/api/v1/health`

## Docker Quickstart

Use the root `env.example` as the starting point for Docker Compose:

```bash
cp env.example .env.local
```

Edit `.env.local` before starting the stack add all the required values.

Then start everything:

```bash
docker compose --env-file .env.local up --build -d
```

Open `http://localhost:3001` after the services are healthy.

## Local Development

For non-Docker setup, use the app-specific guides:

- [Client setup](./client/README.md)
- [Server setup](./server/README.md)

## Sample Q&A

### 1. Engineering department

**User:** Tell me about the Engineering department.

**Assistant:** Engineering is led by Sarah Chen and has 48 team members. The team owns software development, infrastructure, and technical architecture, and recent projects include the AWS migration, API v3 redesign, and an internal developer portal.

### 2. HR lead and headcount

**User:** How many people work in HR and who leads it?

**Assistant:** Human Resources has 12 team members and is led by Michael O'Brien. The team handles recruitment, employee relations, benefits administration, and company culture initiatives.

### 3. Off-topic refusal

**User:** What's the weather like today?

**Assistant:** I'm a Department Information Assistant and can only help with questions about company departments. Ask about Engineering, Marketing, Sales, Human Resources, or Finance.

## Why The BFF Proxy Exists

The Next.js route handlers in `client/src/app/api/session/route.ts` and `client/src/app/api/chat/route.ts` act as a Backend for Frontend layer.

- The browser never calls NestJS directly.
- `API_URL` stays server-side and is never exposed to client JavaScript.
- `sessionId` is stored in an HTTP-only cookie.
- The SSE response from NestJS is proxied through Next.js to the browser.
- NestJS `404` and `410` responses are mapped to `{ sessionExpired: true }`.
- Client-side rate limiting is tracked in an HTTP-only `chatRateLimit` cookie.
