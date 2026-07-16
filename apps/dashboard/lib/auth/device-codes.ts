import { createHash, randomBytes } from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';

export interface DeviceCodeRecord {
  id: string;
  device_code_hash: string;
  user_code: string;
  client_id: string;
  approved: boolean;
  user_id: string | null;
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
  created_at: string;
}

export function hashDeviceCode(deviceCode: string): string {
  return createHash('sha256').update(deviceCode).digest('hex');
}

export function normalizeUserCode(userCode: string): string {
  return userCode.toUpperCase().replace(/-/g, '');
}

export function generateDeviceCode(): string {
  return randomBytes(32).toString('hex');
}

export function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part(4)}-${part(4)}`;
}

export async function createDeviceCode(input: {
  deviceCode: string;
  userCode: string;
  clientId: string;
  expiresAt: Date;
}): Promise<void> {
  const supabase = getAdminClient() as any;
  const { error } = await supabase.from('device_auth_codes').insert({
    device_code_hash: hashDeviceCode(input.deviceCode),
    user_code: normalizeUserCode(input.userCode),
    client_id: input.clientId,
    expires_at: input.expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to store device code: ${error.message}`);
  }
}

export async function findDeviceCodeByUserCode(userCode: string): Promise<DeviceCodeRecord | null> {
  const supabase = getAdminClient() as any;
  const { data, error } = await supabase
    .from('device_auth_codes')
    .select('*')
    .eq('user_code', normalizeUserCode(userCode))
    .is('consumed_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  return data as DeviceCodeRecord;
}

export async function findDeviceCodeByDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null> {
  const supabase = getAdminClient() as any;
  const { data, error } = await supabase
    .from('device_auth_codes')
    .select('*')
    .eq('device_code_hash', hashDeviceCode(deviceCode))
    .is('consumed_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  return data as DeviceCodeRecord;
}

export async function approveDeviceCode(input: {
  id: string;
  userId: string;
}): Promise<void> {
  const supabase = getAdminClient() as any;
  const { error } = await supabase
    .from('device_auth_codes')
    .update({
      approved: true,
      user_id: input.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .is('consumed_at', null);

  if (error) {
    throw new Error(`Failed to approve device code: ${error.message}`);
  }
}

export async function consumeDeviceCode(id: string): Promise<void> {
  const supabase = getAdminClient() as any;
  const { error } = await supabase
    .from('device_auth_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null);

  if (error) {
    throw new Error(`Failed to consume device code: ${error.message}`);
  }
}

export function isExpired(record: DeviceCodeRecord): boolean {
  return Date.now() > new Date(record.expires_at).getTime();
}
