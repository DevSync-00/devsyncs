# DevSync Analyzer Service

Secure backend service that powers the OAuth 2.1 Device Authorization Flow for the DevSync CLI, VS Code extension, and dashboard device approval page.

## Features

- Fastify-based HTTP API (`POST /api/auth/device/start`, `POST /api/auth/device/token`, plus helper lookup/approval endpoints)
- Supabase Admin API integration for verifying signed-in users
- Redis-backed device code storage with strict expirations and polling enforcement
- JWT access + refresh tokens (HS256) issued for CLI and VS Code clients
- Fully typed with Zod validation, helpful structured errors, and pino logging

## Getting Started

```bash
cd apps/analyzer
npm install
npm run dev
```

Environment variables (see `.env.example` in deployment):

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port (default `4000`) |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |
| `AUTH_JWT_SECRET` | HS256 secret for JWT signing |
| `AUTH_JWT_ISSUER` | Issuer claim (default `devsync-analyzer`) |
| `DEVICE_VERIFICATION_URI` | URL that users visit to enter the code (default `https://app.myproduct.com/device`) |
| `DEVICE_CODE_EXPIRES_IN` | Lifetime for device codes in seconds (default `600`) |
| `DEVICE_POLL_INTERVAL` | Minimum polling interval in seconds (default `5`) |

## Scripts

- `npm run dev` – start Fastify in watch mode (tsx)
- `npm run build` – type-check and emit to `dist/`
- `npm start` – run compiled server

## Project Layout

```
apps/analyzer/
  src/
    api/auth/device/   # HTTP route handlers
    lib/               # Redis, Supabase, JWT helpers
    config.ts          # Strongly typed environment config
    index.ts           # Fastify bootstrap
```

## Testing the Device Flow

1. `POST /api/auth/device/start` with `{ "client_id": "cli" }`.
2. Open the dashboard `/device` page, enter the `user_code` that was returned, and approve the login.
3. Poll `POST /api/auth/device/token` with `{ "device_code": "<from step 1>" }` until tokens are issued.

Tokens are standard JWTs and can be inspected via `jwt.io` for debugging.

