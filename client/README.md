# Client

Next.js 16 frontend for the Department Assistant. This app renders the chat UI and exposes BFF route handlers that proxy session and chat requests to the NestJS API.

## Prerequisites

- Node.js 20+
- pnpm
- The backend running at `http://localhost:3000`

## Environment

Copy the example file and point the client to the backend:

```bash
cp .env.example .env.local
```

Set:

```env
API_URL=http://localhost:3000
```

`NODE_ENV` is optional for local development and defaults to `development` in the example file.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`.

## Available Scripts

- `pnpm dev` starts the Next.js development server
- `pnpm build` builds the production bundle
- `pnpm start` runs the production server
- `pnpm lint` runs ESLint

## How The Client Talks To The Backend

The browser talks to the Next.js app, not directly to NestJS:

- `POST /api/session` creates a chat session
- `DELETE /api/session` clears the current session
- `POST /api/chat` proxies the streaming chat request

Those route handlers use the server-side `API_URL` environment variable to reach the backend, keep `sessionId` in an HTTP-only cookie, and translate backend session expiration into client-friendly responses.
