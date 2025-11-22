import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config.js';
import { DeviceClientId } from '../types.js';

interface BaseTokenPayload extends JwtPayload {
  sub: string;
  aud: DeviceClientId;
  scope: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(userId: string, clientId: DeviceClientId) {
  const payload: BaseTokenPayload = {
    sub: userId,
    aud: clientId,
    scope: 'device',
    type: 'access',
  };

  return jwt.sign(payload, config.jwtSecret, {
    issuer: config.jwtIssuer,
    expiresIn: config.accessTokenTtlSeconds,
  });
}

export function signRefreshToken(userId: string, clientId: DeviceClientId) {
  const payload: BaseTokenPayload = {
    sub: userId,
    aud: clientId,
    scope: 'device',
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwtSecret, {
    issuer: config.jwtIssuer,
    expiresIn: config.refreshTokenTtlSeconds,
  });
}

export function verifyRefreshToken(token: string) {
  const decoded = jwt.verify(token, config.jwtSecret, {
    issuer: config.jwtIssuer,
  }) as BaseTokenPayload;

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

export function decodeJwt(token: string) {
  return jwt.decode(token) as BaseTokenPayload | null;
}

