/**
 * Puter.js Codex API Provider
 * 
 * Puter.js provides free access to Codex models via OpenRouter.
 * Uses user-pays model - no developer API key required.
 * 
 * Model: openrouter:openai/gpt-5.1-codex-max (default)
 */

export interface PuterConfig {
  model?: string;
  baseUrl?: string;
}

export interface PuterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PuterCompletionOptions {
  messages: PuterMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface PuterCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: PuterMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Puter.js Codex Client
 * 
 * Uses OpenRouter API to access Codex models.
 * No API key required - uses user-pays model.
 */
export class PuterClient {
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: PuterConfig = {}) {
    // OpenRouter API endpoint (used by Puter.js)
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    // Default to Codex Max model
    this.defaultModel = config.model || 'openai/gpt-5.1-codex-max';
  }

  /**
   * Create a chat completion using Puter.js Codex
   */
  async createCompletion(options: PuterCompletionOptions): Promise<PuterCompletionResponse> {
    const model = options.model || this.defaultModel;
    
    // Use OpenRouter API (which Puter.js uses under the hood)
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://devsync.ai', // Optional: identify your app
        'X-Title': 'DevSync', // Optional: identify your app
        // No Authorization header needed - user-pays model
      },
      body: JSON.stringify({
        model: model.startsWith('openrouter:') ? model : `openrouter:${model}`,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens ?? 2000,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Puter.js/OpenRouter API error (${response.status}): ${response.statusText}`;
      try {
        const errorData: any = await response.json();
        if (errorData?.error?.message) {
          errorMessage = `Puter.js/OpenRouter API error: ${errorData.error.message}`;
        }
      } catch {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Extract token usage from response
   */
  extractTokenUsage(response: PuterCompletionResponse): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    return {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };
  }
}
