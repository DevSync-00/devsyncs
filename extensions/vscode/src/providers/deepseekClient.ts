/**
 * DeepSeek API Client for VS Code Extension
 * 
 * Provides DeepSeek API integration for chat completions and streaming.
 * Compatible with OpenAI API format.
 */

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekCompletionOptions {
  messages: DeepSeekMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface DeepSeekCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export class DeepSeekClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.deepseek.com/v1';
    this.defaultModel = model || 'deepseek-chat';
    this.timeout = 30000;
  }

  /**
   * Create a chat completion (non-streaming)
   */
  async createCompletion(options: DeepSeekCompletionOptions): Promise<DeepSeekCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: options.model || this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw this.normalizeError(response.status, errorData);
      }

      return await response.json() as DeepSeekCompletionResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek API request timeout');
      }
      throw error;
    }
  }

  /**
   * Create a streaming chat completion
   */
  async *createStreamingCompletion(
    options: DeepSeekCompletionOptions
  ): AsyncGenerator<DeepSeekStreamChunk, void, unknown> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: options.model || this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw this.normalizeError(response.status, errorData);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                yield data;
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek API request timeout');
      }
      throw error;
    }
  }

  /**
   * Normalize DeepSeek API errors
   */
  private normalizeError(status: number, errorData: any): Error {
    const errorMessage = errorData?.error?.message || errorData?.message || 'Unknown error';

    switch (status) {
      case 401:
        return new Error(`DeepSeek API authentication failed: Invalid API key`);
      case 429:
        return new Error(`DeepSeek API rate limit exceeded: ${errorMessage}`);
      case 500:
      case 502:
      case 503:
        return new Error(`DeepSeek API server error: ${errorMessage}`);
      case 404:
        return new Error(`DeepSeek API model not found: ${errorMessage}`);
      default:
        return new Error(`DeepSeek API error (${status}): ${errorMessage}`);
    }
  }
}

