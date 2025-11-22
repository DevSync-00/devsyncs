import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserFromAccessToken } from '../../../lib/supabase.js';
import { getGrantByUserCode } from '../../../lib/device-store.js';
import { DeviceClientId } from '../../../types.js';

const userCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'user_code must match XXXX-YYYY format'));

const requestSchema = z.object({
  user_code: userCodeSchema,
});

const CLIENT_NAMES: Record<DeviceClientId, string> = {
  cli: 'DevSync CLI',
  vscode: 'DevSync VS Code Extension',
};

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

export async function registerDeviceLookupRoute(app: FastifyInstance) {
  app.post('/api/auth/device/lookup', async (request, reply) => {
    const accessToken = extractBearerToken(request.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'invalid_token', error_description: 'Missing Supabase session' });
    }

    try {
      await getUserFromAccessToken(accessToken);
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

    const grant = await getGrantByUserCode(parsed.data.user_code);
    if (!grant) {
      return reply.status(404).send({
        error: 'not_found',
        error_description: 'Device code not found',
      });
    }

    const expiresIn = Math.max(0, Math.floor((grant.expiresAt - Date.now()) / 1000));

    return reply.send({
      client_id: grant.clientId,
      client_name: CLIENT_NAMES[grant.clientId],
      user_code: grant.userCode,
      approved: grant.approved,
      expires_in: expiresIn,
      created_at: grant.createdAt,
    });
  });
}

