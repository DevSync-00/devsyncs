/**
 * Unified AI Provider Resolution Utility
 * 
 * This module provides a single source of truth for AI provider resolution
 * across CLI, VS Code extension, and dashboard.
 * 
 * Default behavior: Always defaults to Puter.js Codex 5.1 Max unless explicitly overridden.
 */

export type AIProvider = 'puter' | 'openai' | 'deepseek' | 'ollama';

export interface AIProviderConfig {
  provider: AIProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Default AI provider configuration
 */
export const DEFAULT_AI_PROVIDER: AIProvider = 'puter';
export const DEFAULT_PUTER_MODEL = 'openrouter:openai/gpt-5.1-codex-max';

/**
 * Resolve AI provider from various sources with priority:
 * 1. Explicit provider parameter (highest priority)
 * 2. Config file value
 * 3. Environment variable
 * 4. Default to Puter.js Codex (lowest priority)
 * 
 * @param options - Provider resolution options
 * @returns Resolved AI provider configuration
 */
export function resolveAIProvider(options?: {
  explicitProvider?: string;
  configProvider?: string;
  envProvider?: string;
}): AIProvider {
  // Priority 1: Explicit provider (from CLI flag, etc.)
  if (options?.explicitProvider) {
    const provider = normalizeProvider(options.explicitProvider);
    if (provider) {
      return provider;
    }
  }

  // Priority 2: Config file value
  if (options?.configProvider) {
    const provider = normalizeProvider(options.configProvider);
    if (provider) {
      return provider;
    }
  }

  // Priority 3: Environment variable
  if (options?.envProvider) {
    const provider = normalizeProvider(options.envProvider);
    if (provider) {
      return provider;
    }
  }

  // Priority 4: Default to Puter.js Codex (fail-safe)
  return DEFAULT_AI_PROVIDER;
}

/**
 * Normalize provider string to valid AIProvider type
 */
function normalizeProvider(provider: string | undefined | null): AIProvider | null {
  if (!provider) {
    return null;
  }

  const normalized = provider.toLowerCase().trim();
  
  switch (normalized) {
    case 'puter':
    case 'puter.js':
    case 'codex':
      return 'puter';
    case 'openai':
    case 'gpt':
      return 'openai';
    case 'deepseek':
    case 'deep-seek':
      return 'deepseek';
    case 'ollama':
      return 'ollama';
    default:
      return null;
  }
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'puter':
      return DEFAULT_PUTER_MODEL;
    case 'openai':
      return 'gpt-4o-mini';
    case 'deepseek':
      return 'deepseek-chat';
    case 'ollama':
      return 'llama3.2:3b';
    default:
      return DEFAULT_PUTER_MODEL; // Fail-safe to Puter.js
  }
}

/**
 * Get API base URL for a provider
 */
export function getProviderBaseUrl(provider: AIProvider): string | null {
  switch (provider) {
    case 'puter':
      // Puter.js uses client-side SDK, no direct API URL needed
      return null;
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'ollama':
      return 'http://localhost:11434';
    default:
      return null;
  }
}

/**
 * Check if provider requires an API key
 */
export function requiresAPIKey(provider: AIProvider): boolean {
  // Puter.js uses user-pays model, no developer API key needed
  return provider !== 'puter' && provider !== 'ollama';
}

/**
 * Get human-readable model name for display
 */
export function getModelDisplayName(provider: AIProvider, model?: string): string {
  const actualModel = model || getDefaultModel(provider);
  
  // Remove openrouter: prefix if present for display
  const cleanModel = actualModel.replace(/^openrouter:/, '');
  
  switch (provider) {
    case 'puter':
      // Format: "Puter.js Codex 5.1 Max" or "Puter.js Codex"
      if (cleanModel.includes('gpt-5.1-codex-max')) {
        return 'Puter.js Codex 5.1 Max';
      } else if (cleanModel.includes('gpt-5.1-codex')) {
        return 'Puter.js Codex 5.1';
      } else if (cleanModel.includes('codex')) {
        return 'Puter.js Codex';
      }
      return `Puter.js (${cleanModel})`;
    case 'openai':
      return cleanModel.includes('gpt-4o-mini') ? 'OpenAI GPT-4o Mini' : `OpenAI ${cleanModel}`;
    case 'deepseek':
      return cleanModel.includes('deepseek-chat') ? 'DeepSeek Chat' : `DeepSeek ${cleanModel}`;
    case 'ollama':
      return `Ollama ${cleanModel}`;
    default:
      return cleanModel;
  }
}

/**
 * Get full model information for display
 */
export function getModelInfo(provider: AIProvider, model?: string): {
  provider: string;
  model: string;
  displayName: string;
} {
  const actualModel = model || getDefaultModel(provider);
  const cleanModel = actualModel.replace(/^openrouter:/, '');
  
  return {
    provider: provider === 'puter' ? 'Puter.js' : provider.charAt(0).toUpperCase() + provider.slice(1),
    model: cleanModel,
    displayName: getModelDisplayName(provider, model)
  };
}
