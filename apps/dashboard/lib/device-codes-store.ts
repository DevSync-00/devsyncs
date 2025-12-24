// Store device codes in memory (in production, use Redis or database)
// Moved to lib directory to avoid Next.js route handler export restrictions
const deviceCodesMap = new Map<
  string,
  {
    deviceCode: string;
    userCode: string;
    clientId: string;
    expiresAt: number;
    approved: boolean;
    userId?: string;
  }
>();

// Export getter/setter functions instead of the Map directly
export const deviceCodes = {
  get: (key: string) => deviceCodesMap.get(key),
  set: (key: string, value: {
    deviceCode: string;
    userCode: string;
    clientId: string;
    expiresAt: number;
    approved: boolean;
    userId?: string;
  }) => deviceCodesMap.set(key, value),
  delete: (key: string) => deviceCodesMap.delete(key),
  entries: () => deviceCodesMap.entries(),
  keys: () => deviceCodesMap.keys(),
};

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of deviceCodesMap.entries()) {
    if (value.expiresAt < now) {
      deviceCodesMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
