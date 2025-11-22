# OAuth Device Authorization Flow - Implementation Guide

This document describes the complete OAuth 2.1 Device Authorization Flow implementation across the DevSync monorepo.

## 📋 Overview

The device flow allows CLI tools and VS Code extensions to securely authenticate users without embedding client secrets or requiring a web browser on the same device.

### Flow Diagram

```
┌─────────┐                                  ┌──────────┐
│   CLI   │                                  │ Browser  │
│   or    │                                  │  (User)  │
│ VS Code │                                  └──────────┘
└─────────┘                                       │
     │                                            │
     │ 1. POST /api/auth/device/start             │
     ├──────────────────────────────────►         │
     │                                            │
     │ 2. {device_code, user_code, uri}           │
     │◄──────────────────────────────────         │
     │                                            │
     │ 3. Display: "Go to URI and enter CODE"    │
     │                                            │
     │                                   4. User opens URI
     │                                            │
     │                                   5. Enter user_code
     │                                            │
     │                                   6. Sign in (Supabase)
     │                                            │
     │                                   7. Approve device
     │                                            │
     │ 8. Poll: POST /api/auth/device/token       │
     │    (every 5 seconds)                       │
     ├──────────────────────────────────►         │
     │                                            │
     │ 9. {access_token, refresh_token}           │
     │◄──────────────────────────────────         │
     │                                            │
     │ 10. Store tokens locally                   │
     │                                            │
```

## 🏗️ Architecture

### Components

1. **Backend Analyzer Service** (`apps/analyzer`)
   - Fastify REST API
   - OAuth device flow endpoints
   - Redis for device code storage
   - JWT signing for tokens
   - Supabase Auth integration

2. **Dashboard Web App** (`apps/dashboard`)
   - Next.js 14 App Router
   - Device approval page at `/device`
   - Supabase Auth for user sessions
   - React Hook Form + Zod validation

3. **Marketing Site** (`src/`)
   - Vite + React
   - Device approval page at `/device`
   - Shared UX with dashboard

4. **CLI** (`packages/cli`)
   - `devsync login` command
   - Token storage in `~/.config/devsync/config.json`
   - Automatic token refresh

5. **VS Code Extension** (`extensions/vscode`)
   - Auth on activation
   - Token storage in VS Code secrets
   - Automatic token refresh

## 🔐 Security Features

### 1. Rate Limiting

All endpoints are rate-limited using Redis-based sliding window counters:

- **Device Start**: 20 req/min per IP
- **Token Poll**: 60 req/min per device_code
- **Approval**: 10 req/min per user
- **Lookup**: 20 req/min per IP

### 2. Token Security

- **Access Tokens**: 1 hour expiry, JWT signed
- **Refresh Tokens**: 30 days expiry, JWT signed
- **Secret**: Minimum 32 characters, configurable via `AUTH_JWT_SECRET`
- **Issuer**: Configurable via `AUTH_JWT_ISSUER`

### 3. Device Code Security

- **User Codes**: 8-character alphanumeric (no confusing chars)
- **Device Codes**: 32-byte base64url random
- **Expiry**: 10 minutes (configurable)
- **One-time use**: Device code deleted after token issuance

### 4. PKCE & RLS

- Dashboard uses Supabase PKCE flow for user sessions
- Backend validates Supabase tokens via Admin API
- Row Level Security policies enforce user isolation

## 🔄 API Endpoints

### 1. POST /api/auth/device/start

Initiates device authorization flow.

**Request:**
```json
{
  "client_id": "cli" | "vscode"
}
```

**Response:**
```json
{
  "device_code": "...",
  "user_code": "ABCD-EFGH",
  "verification_uri": "https://app.devsync.com/device",
  "expires_in": 600,
  "interval": 5
}
```

**Errors:**
- `400 invalid_request`: Invalid or missing client_id
- `429 rate_limit_exceeded`: Too many requests

### 2. POST /api/auth/device/token

Polls for token issuance.

**Request:**
```json
{
  "device_code": "..."
}
```

**Response (success):**
```json
{
  "token_type": "Bearer",
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "refresh_expires_in": 2592000,
  "user_id": "...",
  "client_id": "cli"
}
```

**Response (pending):**
```json
{
  "error": "authorization_pending",
  "error_description": "Awaiting user approval"
}
```

**Errors:**
- `400 authorization_pending`: User hasn't approved yet (continue polling)
- `400 slow_down`: Polling too fast, increase interval by 2 seconds
- `400 expired_token`: Device code expired or already used
- `429`: Rate limit exceeded

### 3. POST /api/auth/device/lookup

Looks up device info by user_code (requires auth).

**Headers:**
```
Authorization: Bearer <supabase_token>
```

**Request:**
```json
{
  "user_code": "ABCD-EFGH"
}
```

**Response:**
```json
{
  "client_id": "cli",
  "client_name": "DevSync CLI",
  "user_code": "ABCD-EFGH",
  "approved": false,
  "expires_in": 542,
  "created_at": 1234567890
}
```

**Errors:**
- `401 invalid_token`: Missing or invalid Supabase token
- `404 not_found`: User code not found
- `400 invalid_request`: Invalid user_code format
- `429 rate_limit_exceeded`: Too many requests

### 4. POST /api/auth/device/approve

Approves a device (requires auth).

**Headers:**
```
Authorization: Bearer <supabase_token>
```

**Request:**
```json
{
  "user_code": "ABCD-EFGH"
}
```

**Response:**
```json
{
  "status": "approved",
  "client_id": "cli",
  "approved_at": 1234567890
}
```

**Errors:**
- `401 invalid_token`: Missing or invalid Supabase token
- `404 not_found`: User code not found
- `400 expired_token`: Device code expired
- `409 already_approved`: Already approved
- `429 rate_limit_exceeded`: Too many approval attempts

### 5. POST /api/auth/token/refresh

Refreshes access token.

**Request:**
```json
{
  "refresh_token": "..."
}
```

**Response:**
```json
{
  "token_type": "Bearer",
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "refresh_expires_in": 2592000,
  "user_id": "...",
  "client_id": "cli"
}
```

**Errors:**
- `400 invalid_request`: Missing refresh_token
- `401 invalid_grant`: Invalid or expired refresh token

## 📦 Data Storage

### Redis Schema

**Device Grant:**
```
Key: device_grant:<device_code>
Value: JSON {
  deviceCode: string,
  userCode: string,
  clientId: 'cli' | 'vscode',
  createdAt: number,
  expiresAt: number,
  interval: number,
  approved: boolean,
  supabaseUserId: string | null,
  approvedAt?: number,
  lastPollAt?: number,
  issuedTokensAt?: number
}
TTL: expires_in seconds
```

**User Code Index:**
```
Key: device_user_code:<user_code>
Value: <device_code>
TTL: expires_in seconds
```

**Rate Limit:**
```
Key: ratelimit:<identifier>
Value: Sorted set of timestamps
TTL: window_seconds
```

### Local Storage

**CLI (`~/.config/devsync/config.json`):**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1234567890,
  "clientId": "cli"
}
```

**VS Code Extension:**
Stored in VS Code secrets API under key `devsync-token`:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1234567890
}
```

## 🛠️ Setup Instructions

### 1. Backend Analyzer

```bash
cd apps/analyzer

# Copy environment template
cp ENV_TEMPLATE .env

# Edit .env and fill in:
# - REDIS_URL
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - AUTH_JWT_SECRET (generate: openssl rand -base64 32)
# - DEVICE_VERIFICATION_URI

# Install dependencies
npm install

# Run in development
npm run dev

# Run tests
npm test
```

### 2. Dashboard

```bash
cd apps/dashboard

# Copy environment template
cp ENV_TEMPLATE .env.local

# Edit .env.local and fill in:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_ANALYZER_API_URL

# Install dependencies
npm install

# Run in development
npm run dev

# Run tests
npm test
```

### 3. CLI

```bash
cd packages/cli

# Build CLI
npm run build

# Link globally (optional)
npm link

# Test login flow
devsync login

# Check status
devsync status
```

### 4. VS Code Extension

```bash
cd extensions/vscode

# Install dependencies
npm install

# Compile
npm run compile

# Open in VS Code
code .

# Press F5 to launch Extension Development Host
# The extension will auto-authenticate on activation
```

## 🧪 Testing

### Manual Testing

1. **Start Backend:**
   ```bash
   cd apps/analyzer
   npm run dev
   ```

2. **Start Dashboard:**
   ```bash
   cd apps/dashboard
   npm run dev
   ```

3. **Test CLI Flow:**
   ```bash
   devsync login
   # Follow instructions, approve in browser
   devsync status
   ```

4. **Test VS Code:**
   - Open workspace in VS Code
   - Extension activates and prompts for login
   - Follow instructions, approve in browser

### Automated Tests

```bash
# Backend tests
cd apps/analyzer
npm test

# Dashboard tests
cd apps/dashboard
npm test

# CLI tests
cd packages/cli
npm test

# Marketing site tests
npm test
```

## 🔍 Troubleshooting

### CLI says "Not authenticated"

**Solution:**
```bash
devsync login
```

### VS Code extension fails to authenticate

**Solutions:**
1. Check `devsync.apiUrl` in settings
2. Verify analyzer service is running
3. Check VS Code Developer Tools console for errors

### "Rate limit exceeded" errors

**Solutions:**
1. Wait 60 seconds and try again
2. Check Redis connection
3. Verify rate limit configuration

### Token refresh fails

**Solutions:**
1. Run `devsync login` again
2. Check AUTH_JWT_SECRET matches between token issuance and refresh
3. Verify refresh token hasn't expired (30 days)

### Device code expired

**Solutions:**
1. Codes expire in 10 minutes
2. Complete approval flow faster
3. Increase DEVICE_CODE_EXPIRES_IN if needed

## 📚 References

- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://datatracker.ietf.org/doc/html/rfc8628)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-09)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Redis Rate Limiting](https://redis.io/docs/manual/patterns/rate-limiter/)

## 🔒 Best Practices

1. **Never log tokens** - tokens are sensitive credentials
2. **Always use HTTPS** in production for verification_uri
3. **Rotate JWT secrets** periodically
4. **Monitor rate limits** - adjust if legitimate traffic is blocked
5. **Set short access token expiry** - 1 hour max
6. **Use refresh tokens** - allow longer sessions without re-auth
7. **Clean up expired grants** - Redis TTL handles this automatically
8. **Validate all inputs** - use Zod schemas
9. **Handle errors gracefully** - follow OAuth error response format
10. **Test thoroughly** - all flows, error cases, and edge conditions

## 🚀 Production Deployment

### Environment Variables

Ensure all services have proper production values:

- Set `NODE_ENV=production`
- Use production Redis URL (SSL/TLS enabled)
- Use production Supabase URL and keys
- Generate strong JWT secret (64+ characters)
- Set DEVICE_VERIFICATION_URI to production dashboard URL
- Configure CORS_ORIGINS to only allow production domains

### Infrastructure

- Deploy analyzer service behind HTTPS reverse proxy
- Use Redis Cluster for high availability
- Enable Redis persistence (AOF + RDB)
- Set up monitoring and alerting
- Configure log aggregation
- Use CDN for dashboard and marketing site

### Security Checklist

- [ ] HTTPS only for all services
- [ ] Strong JWT secret (64+ characters)
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Supabase RLS policies active
- [ ] Redis auth enabled
- [ ] Regular security audits
- [ ] Token rotation policy
- [ ] Incident response plan

---

**Built with ❤️ by the DevSync team**

