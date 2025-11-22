import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET must be at least 32 characters'),
  AUTH_JWT_ISSUER: z.string().default('devsync-analyzer'),
  DEVICE_VERIFICATION_URI: z
    .string()
    .url('DEVICE_VERIFICATION_URI must be a valid https:// URL')
    .default('https://app.myproduct.com/device'),
  DEVICE_CODE_EXPIRES_IN: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  DEVICE_POLL_INTERVAL: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  CORS_ORIGINS: z.string().optional(),
});

const parsedEnv = EnvSchema.parse(process.env);

export const config = {
  nodeEnv: parsedEnv.NODE_ENV,
  port: parsedEnv.PORT ?? 4000,
  redisUrl: parsedEnv.REDIS_URL,
  supabaseUrl: parsedEnv.SUPABASE_URL,
  supabaseServiceRoleKey: parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: parsedEnv.AUTH_JWT_SECRET,
  jwtIssuer: parsedEnv.AUTH_JWT_ISSUER,
  deviceVerificationUri: parsedEnv.DEVICE_VERIFICATION_URI,
  deviceCodeExpiresIn: parsedEnv.DEVICE_CODE_EXPIRES_IN ?? 600,
  devicePollInterval: parsedEnv.DEVICE_POLL_INTERVAL ?? 5,
  accessTokenTtlSeconds: 60 * 60, // 1 hour
  refreshTokenTtlSeconds: 60 * 60 * 24 * 30, // 30 days
  corsOrigins: parsedEnv.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? ['*'],
} as const;

