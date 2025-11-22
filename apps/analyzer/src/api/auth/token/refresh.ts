import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '../../../lib/jwt.js';
import { config } from '../../../config.js';

const requestSchema = z.object({
  refresh_token: z.string().min(10, 'refresh_token is required'),
});

export async function registerRefreshTokenRoute(app: FastifyInstance) {
  app.post('/api/auth/token/refresh', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        error_description: parsed.error.errors[0]?.message ?? 'Invalid refresh_token',
      });
    }

    try {
      const payload = verifyRefreshToken(parsed.data.refresh_token);
      const accessToken = signAccessToken(payload.sub, payload.aud);
      const refreshToken = signRefreshToken(payload.sub, payload.aud);

      return reply.send({
        token_type: 'Bearer',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: config.accessTokenTtlSeconds,
        refresh_expires_in: config.refreshTokenTtlSeconds,
        user_id: payload.sub,
        client_id: payload.aud,
      });
    } catch {
      return reply.status(401).send({
        error: 'invalid_grant',
        error_description: 'Refresh token invalid or expired',
      });
    }
  });
}

