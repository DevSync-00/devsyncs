export function requiredEnv(name: string, aliases: string[] = []): string {
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  throw new Error(`Missing required environment variable: ${candidates.join(' or ')}`);
}

export function optionalEnv(name: string, aliases: string[] = []): string | undefined {
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

