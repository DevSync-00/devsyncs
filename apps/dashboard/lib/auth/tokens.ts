import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export interface DevSyncTokenPayload {
  sub: string;
  email?: string;
  role: 'authenticated';
  aud: 'authenticated';
  iss: string;
  iat: number;
  exp: number;
  typ: 'access' | 'refresh';
  client_id?: string;
  jti: string;
}

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function getSigningSecret(): string {
  const secret = process.env.DEVSYNC_TOKEN_SIGNING_SECRET || process.env.SUPABASE_JWT_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEVSYNC_TOKEN_SIGNING_SECRET with at least 32 characters is required');
  }

  return 'dev-only-token-signing-secret-change-before-production';
}

function sign(input: string): string {
  return createHmac('sha256', getSigningSecret()).update(input).digest('base64url');
}

export function signJwt(payload: DevSyncTokenPayload): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  return `${signingInput}.${sign(signingInput)}`;
}

export function verifyJwt(token: string, expectedType?: 'access' | 'refresh'): DevSyncTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSignature = sign(signingInput);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as DevSyncTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!decoded.sub || decoded.exp <= now) {
      return null;
    }

    if (expectedType && decoded.typ !== expectedType) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function issueDevSyncTokens(input: {
  userId: string;
  email?: string;
  clientId: string;
}): IssuedTokens {
  const now = Math.floor(Date.now() / 1000);
  const issuer = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || 'devsync';

  const common = {
    sub: input.userId,
    email: input.email || '',
    role: 'authenticated' as const,
    aud: 'authenticated' as const,
    iss: issuer,
    iat: now,
    client_id: input.clientId,
  };

  const accessPayload: DevSyncTokenPayload = {
    ...common,
    typ: 'access',
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomUUID(),
  };

  const refreshPayload: DevSyncTokenPayload = {
    ...common,
    typ: 'refresh',
    exp: now + REFRESH_TOKEN_TTL_SECONDS,
    jti: randomUUID(),
  };

  return {
    access_token: signJwt(accessPayload),
    refresh_token: signJwt(refreshPayload),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
  };
}

