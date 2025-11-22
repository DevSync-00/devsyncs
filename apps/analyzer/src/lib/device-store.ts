import { redis } from './redis.js';
import { DeviceGrant } from '../types.js';

const DEVICE_KEY_PREFIX = 'device_grant:';
const USER_CODE_PREFIX = 'device_user_code:';

const deviceKey = (deviceCode: string) => `${DEVICE_KEY_PREFIX}${deviceCode}`;
const userCodeKey = (userCode: string) => `${USER_CODE_PREFIX}${userCode}`;

const remainingTtl = (grant: DeviceGrant) => Math.max(1, grant.expiresAt - Date.now());

async function persistGrant(grant: DeviceGrant) {
  const ttl = remainingTtl(grant);
  await redis
    .multi()
    .set(deviceKey(grant.deviceCode), JSON.stringify(grant), 'PX', ttl)
    .set(userCodeKey(grant.userCode), grant.deviceCode, 'PX', ttl)
    .exec();
}

export async function createGrant(grant: DeviceGrant) {
  await persistGrant(grant);
}

export async function getGrantByDeviceCode(deviceCode: string): Promise<DeviceGrant | null> {
  const data = await redis.get(deviceKey(deviceCode));
  if (!data) {
    return null;
  }
  return JSON.parse(data) as DeviceGrant;
}

export async function getGrantByUserCode(userCode: string): Promise<DeviceGrant | null> {
  const code = await redis.get(userCodeKey(userCode));
  if (!code) {
    return null;
  }
  return getGrantByDeviceCode(code);
}

export async function updateGrant(deviceCode: string, updater: (current: DeviceGrant) => DeviceGrant | Promise<DeviceGrant>) {
  const current = await getGrantByDeviceCode(deviceCode);
  if (!current) {
    return null;
  }

  const updated = await updater(current);
  await persistGrant(updated);
  return updated;
}

export async function deleteGrant(deviceCode: string) {
  const grant = await getGrantByDeviceCode(deviceCode);
  if (!grant) {
    return;
  }
  await redis.del(deviceKey(deviceCode), userCodeKey(grant.userCode));
}

export async function approveGrantByUserCode(userCode: string, supabaseUserId: string) {
  const grant = await getGrantByUserCode(userCode);
  if (!grant) {
    return null;
  }

  grant.approved = true;
  grant.supabaseUserId = supabaseUserId;
  grant.approvedAt = Date.now();
  await persistGrant(grant);
  return grant;
}

export async function markPolled(deviceCode: string, timestamp: number) {
  const grant = await getGrantByDeviceCode(deviceCode);
  if (!grant) {
    return null;
  }

  grant.lastPollAt = timestamp;
  await persistGrant(grant);
  return grant;
}

export async function markTokensIssued(deviceCode: string) {
  const grant = await getGrantByDeviceCode(deviceCode);
  if (!grant) {
    return null;
  }

  grant.issuedTokensAt = Date.now();
  await persistGrant(grant);
  return grant;
}

