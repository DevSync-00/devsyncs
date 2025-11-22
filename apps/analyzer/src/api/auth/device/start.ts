import { randomBytes } from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../../../config.js';
import { DeviceClientIdSchema } from '../../../types.js';
import { createGrant } from '../../../lib/device-store.js';
import { logger } from '../../../logger.js';

const requestSchema = z.object({
  client_id: DeviceClientIdSchema,
});

const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateUserCode = () => {
  let raw = '';
  for (let i = 0; i < 8; i += 1) {
    const index = Math.floor(Math.random() * USER_CODE_ALPHABET.length);
    raw += USER_CODE_ALPHABET[index];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
};

const generateDeviceCode = () => randomBytes(32).toString('base64url');

export async function registerDeviceStartRoute(app: FastifyInstance) {
  app.post('/api/auth/device/start', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        error_description: parsed.error.errors[0]?.message ?? 'Invalid request body',
      });
    }

    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const now = Date.now();

    await createGrant({
      deviceCode,
      userCode,
      clientId: parsed.data.client_id,
      createdAt: now,
      expiresAt: now + config.deviceCodeExpiresIn * 1000,
      interval: config.devicePollInterval,
      approved: false,
      supabaseUserId: null,
    });

    logger.debug(
      {
        clientId: parsed.data.client_id,
        deviceCode,
        userCode,
      },
      'Created device grant'
    );

    return reply.send({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: config.deviceVerificationUri,
      expires_in: config.deviceCodeExpiresIn,
      interval: config.devicePollInterval,
    });
  });
}

