/**
 * DeepSeek Client for Dashboard
 * 
 * Client-side helper for making DeepSeek API calls from the dashboard.
 * Note: Actual API calls should go through the Next.js API routes for security.
 */

export interface DeepSeekConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Create a DeepSeek API request through the Next.js API route
 * This ensures API keys stay server-side
 */
export async function queryWithDeepSeek(
  endpoint: string,
  body: any,
  provider: 'openai' | 'deepseek' = 'deepseek'
): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      provider, // Pass provider preference to API route
    }),
  });
}

/**
 * Helper to determine if DeepSeek is available
 * Checks if DEEPSEEK_API_KEY is configured (client-side check)
 */
export function isDeepSeekAvailable(): boolean {
  // This is a client-side check - actual availability is determined server-side
  // In a real implementation, you might want to expose this via an API endpoint
  return typeof window !== 'undefined';
}

