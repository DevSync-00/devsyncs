/**
 * AI Model Information Utility
 * 
 * Provides model information for display in the VS Code extension.
 */

export type AIProvider = 'puter' | 'openai' | 'deepseek' | 'ollama';

export interface ModelInfo {
  provider: string;
  model: string;
  displayName: string;
}

/**
 * Get default model for a provider
 */
function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'puter':
      return 'openai/gpt-5.1-codex-max';
    case 'openai':
      return 'gpt-4o-mini';
    case 'deepseek':
      return 'deepseek-chat';
    case 'ollama':
      return 'llama3.2:3b';
    default:
      return 'openai/gpt-5.1-codex-max';
  }
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
export function getModelInfo(provider: AIProvider, model?: string): ModelInfo {
  const actualModel = model || getDefaultModel(provider);
  const cleanModel = actualModel.replace(/^openrouter:/, '');
  
  return {
    provider: provider === 'puter' ? 'Puter.js' : provider.charAt(0).toUpperCase() + provider.slice(1),
    model: cleanModel,
    displayName: getModelDisplayName(provider, model)
  };
}

/**
 * Get model info from VS Code configuration
 * Note: This function requires vscode module to be imported by the caller
 */
export function getModelInfoFromConfig(vscodeModule?: any): ModelInfo {
  // If vscode module is provided, use it; otherwise try to require it
  const vscode = vscodeModule || (typeof require !== 'undefined' ? require('vscode') : null);
  if (!vscode) {
    // Fallback to default if vscode not available
    return getModelInfo('puter');
  }
  const config = vscode.workspace.getConfiguration('devsync');
  const providerValue = config.get('ai.provider', 'puter');
  const provider = (providerValue || 'puter') as AIProvider;
  return getModelInfo(provider);
}
