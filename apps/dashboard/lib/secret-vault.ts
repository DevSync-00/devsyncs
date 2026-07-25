import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { optionalEnv } from './env';

const VERSION = 'v1';

function encryptionKey(): Buffer {
  const configured = optionalEnv('DEVSYNC_ENVIRONMENT_ENCRYPTION_KEY');
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DEVSYNC_ENVIRONMENT_ENCRYPTION_KEY is required for preview database credentials.');
    }
    // Development-only fallback, scoped to this application. Production
    // refuses to use it so credentials cannot be deployed with a known key.
    return createHash('sha256').update('devsync-local-preview-development-key').digest();
  }
  return createHash('sha256').update(configured).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Unsupported or malformed encrypted secret.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function connectionPreview(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, '') || 'database';
    return `${url.protocol}//***@${url.hostname}${url.port ? `:${url.port}` : ''}/${database}`;
  } catch {
    return 'Configured connection';
  }
}
