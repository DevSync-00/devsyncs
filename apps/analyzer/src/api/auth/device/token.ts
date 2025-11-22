import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  deleteGrant,
  getGrantByDeviceCode,
  markPolled,
  markTokensIssued,
} from '../../../lib/device-store.js';
import { signAccessToken, signRefreshToken } from '../../../lib/jwt.js';
import { config } from '../../../config.js';
import { logger } from '../../../logger.js';

const requestSchema = z.object({
  device_code: z.string().min(10, 'device_code is required'),
});

const sendOAuthError = (reply: FastifyReply, error: string, description?: string, statusCode = 400) =>
  reply.status(statusCode).send({
    error,
    ...(description ? { error_description: description } : {}),
  });

export async function registerDeviceTokenRoute(app: FastifyInstance) {
  app.post('/api/auth/device/token', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendOAuthError(reply, 'invalid_request', parsed.error.errors[0]?.message);
    }

    const grant = await getGrantByDeviceCode(parsed.data.device_code);
    if (!grant) {
      return sendOAuthError(reply, 'expired_token', 'Device code not found');
    }

    const now = Date.now();
    if (now > grant.expiresAt) {
      await deleteGrant(grant.deviceCode);
      return sendOAuthError(reply, 'expired_token', 'Device code expired');
    }

    if (grant.lastPollAt && now - grant.lastPollAt < grant.interval * 1000) {
      return sendOAuthError(reply, 'slow_down', 'Poll interval not respected');
    }

    await markPolled(grant.deviceCode, now);

    if (!grant.approved || !grant.supabaseUserId) {
      return sendOAuthError(reply, 'authorization_pending', 'Awaiting user approval');
    }

    if (grant.issuedTokensAt) {
      await deleteGrant(grant.deviceCode);
      return sendOAuthError(reply, 'expired_token', 'Device code already used');
    }

    const accessToken = signAccessToken(grant.supabaseUserId, grant.clientId);
    const refreshToken = signRefreshToken(grant.supabaseUserId, grant.clientId);

    await markTokensIssued(grant.deviceCode);
    await deleteGrant(grant.deviceCode);

    logger.info(
      {
        clientId: grant.clientId,
        userId: grant.supabaseUserId,
      },
      'Issued device tokens'
    );

    return reply.send({
      token_type: 'Bearer',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.accessTokenTtlSeconds,
      refresh_expires_in: config.refreshTokenTtlSeconds,
      user_id: grant.supabaseUserId,
      client_id: grant.clientId,
    });
  });
}

