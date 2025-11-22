import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserFromAccessToken } from '../../../lib/supabase.js';
import { approveGrantByUserCode, getGrantByUserCode, deleteGrant } from '../../../lib/device-store.js';

const userCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'user_code must match XXXX-YYYY format'));

const requestSchema = z.object({
  user_code: userCodeSchema,
});

const extractBearerToken = (authorization?: string) => {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
};

export async function registerDeviceApproveRoute(app: FastifyInstance) {
  app.post('/api/auth/device/approve', async (request, reply) => {
    const accessToken = extractBearerToken(request.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'invalid_token', error_description: 'Missing Supabase session' });
    }

    let userId: string;
    try {
      const user = await getUserFromAccessToken(accessToken);
      userId = user.id;
    } catch {
      return reply.status(401).send({ error: 'invalid_token', error_description: 'Invalid Supabase session' });
    }

    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        error_description: parsed.error.errors[0]?.message ?? 'Invalid user_code',
      });
    }

    const existing = await getGrantByUserCode(parsed.data.user_code);
    if (!existing) {
      return reply.status(404).send({ error: 'not_found', error_description: 'Device code not found' });
    }

    if (Date.now() > existing.expiresAt) {
      await deleteGrant(existing.deviceCode);
      return reply.status(400).send({ error: 'expired_token', error_description: 'Device code expired' });
    }

    if (existing.approved) {
      return reply.status(409).send({ error: 'already_approved', error_description: 'Device code already approved' });
    }

    const grant = await approveGrantByUserCode(parsed.data.user_code, userId);
    if (!grant) {
      return reply.status(404).send({ error: 'not_found', error_description: 'Device code not found' });
    }

    return reply.send({
      status: 'approved',
      client_id: grant.clientId,
      approved_at: grant.approvedAt,
    });
  });
}

