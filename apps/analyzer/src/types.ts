import { z } from 'zod';

export const DeviceClientIdSchema = z.enum(['cli', 'vscode']);
export type DeviceClientId = z.infer<typeof DeviceClientIdSchema>;

export const DeviceGrantSchema = z.object({
  deviceCode: z.string(),
  userCode: z.string(),
  clientId: DeviceClientIdSchema,
  createdAt: z.number(),
  expiresAt: z.number(),
  interval: z.number(),
  approved: z.boolean(),
  supabaseUserId: z.string().nullable(),
  approvedAt: z.number().optional(),
  lastPollAt: z.number().optional(),
  issuedTokensAt: z.number().optional(),
});

export type DeviceGrant = z.infer<typeof DeviceGrantSchema>;

export interface OAuthTokenResponse {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user_id: string;
  client_id: DeviceClientId;
}

