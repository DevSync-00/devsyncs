/**
 * Configuration schema definitions and validation
 */

/**
 * Configuration value source
 */
export enum ConfigSource {
  DEFAULT = 'default',
  USER = 'user',
  WORKSPACE = 'workspace',
  WORKSPACE_FOLDER = 'workspaceFolder',
}

/**
 * Configuration property definition
 */
export type ConfigValue = string | number | boolean | string[] | Record<string, unknown> | null | undefined;

export interface ConfigProperty {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: ConfigValue;
  required?: boolean;
  description?: string;
  enum?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  validator?: (value: unknown) => boolean | string;
}

/**
 * Full configuration schema
 */
export interface DevSyncConfig {
  // API Configuration
  apiUrl: string;
  apiKey: string;
  projectId: string;
  analyzerUrl: string;

  // Database Configuration
  databaseConnection?: string;

  // Feature Flags
  enableDiagnostics: boolean;
  autoScan: boolean;
  aiAnalysis: boolean;

  // AI Provider Configuration
  useOllama: boolean;
  ollamaModel: string;
  ollamaUrl: string;
  openaiApiKey: string;
  useDeepSeek: boolean;
  deepseekApiKey: string;
  deepseekModel: string;
  deepseekUrl: string;
  aiProvider: 'puter' | 'openai' | 'ollama' | 'deepseek';
}

/**
 * Configuration with metadata
 */
export interface ConfigWithMetadata extends DevSyncConfig {
  _metadata?: {
    version: string;
    lastUpdated: Date;
    source: Record<string, ConfigSource>;
  };
}

/**
 * Configuration schema definitions
 */
export const CONFIG_SCHEMA: Record<keyof DevSyncConfig, ConfigProperty> = {
  apiUrl: {
    key: 'apiUrl',
    type: 'string',
    default: 'http://localhost:3000',
    required: false,
    description: 'DevSync dashboard API URL',
    pattern: '^https?://.+',
    validator: (value: unknown) => {
      if (typeof value === 'string') {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Invalid URL format';
        }
      }
      return 'Value must be a string';
    },
  },
  apiKey: {
    key: 'apiKey',
    type: 'string',
    default: '',
    required: false,
    description: 'DevSync API key (JWT token)',
  },
  projectId: {
    key: 'projectId',
    type: 'string',
    default: '',
    required: false,
    description: 'DevSync project ID',
  },
  analyzerUrl: {
    key: 'analyzerUrl',
    type: 'string',
    default: 'http://localhost:3000',
    required: false,
    description: 'DevSync dashboard URL for device authentication (authentication endpoints are in the dashboard)',
    pattern: '^https?://.+',
    validator: (value: unknown) => {
      if (typeof value === 'string') {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Invalid URL format';
        }
      }
      return 'Value must be a string';
    },
  },
  databaseConnection: {
    key: 'databaseConnection',
    type: 'string',
    default: '',
    required: false,
    description: 'Database connection string',
  },
  enableDiagnostics: {
    key: 'enableDiagnostics',
    type: 'boolean',
    default: true,
    required: false,
    description: 'Enable inline diagnostics for schema mismatches',
  },
  autoScan: {
    key: 'autoScan',
    type: 'boolean',
    default: false,
    required: false,
    description: 'Automatically scan on file save',
  },
  aiAnalysis: {
    key: 'aiAnalysis',
    type: 'boolean',
    default: false,
    required: false,
    description: 'Use AI to analyze codebase and infer schema from code patterns',
  },
  useOllama: {
    key: 'useOllama',
    type: 'boolean',
    default: false,
    required: false,
    description: 'Use Ollama (local, free) instead of OpenAI for AI analysis',
  },
  ollamaModel: {
    key: 'ollamaModel',
    type: 'string',
    default: 'llama3.2:3b',
    required: false,
    description: 'Ollama model name',
  },
  ollamaUrl: {
    key: 'ollamaUrl',
    type: 'string',
    default: 'http://localhost:11434',
    required: false,
    description: 'Ollama API URL',
    pattern: '^https?://.+',
  },
  openaiApiKey: {
    key: 'openaiApiKey',
    type: 'string',
    default: '',
    required: false,
    description: 'OpenAI API key for AI analysis',
  },
  useDeepSeek: {
    key: 'useDeepSeek',
    type: 'boolean',
    default: false,
    required: false,
    description: 'Use DeepSeek instead of OpenAI for AI analysis',
  },
  deepseekApiKey: {
    key: 'deepseekApiKey',
    type: 'string',
    default: '',
    required: false,
    description: 'DeepSeek API key for AI analysis',
  },
  deepseekModel: {
    key: 'deepseekModel',
    type: 'string',
    default: 'deepseek-chat',
    required: false,
    description: 'DeepSeek model name',
  },
  deepseekUrl: {
    key: 'deepseekUrl',
    type: 'string',
    default: 'https://api.deepseek.com/v1',
    required: false,
    description: 'DeepSeek API URL',
    pattern: '^https?://.+',
  },
  aiProvider: {
    key: 'ai.provider',
    type: 'string',
    default: 'puter',
    required: false,
    description: 'AI provider to use for chat and analysis',
    enum: ['puter', 'openai', 'ollama', 'deepseek'],
  },
};

/**
 * Required configuration keys for basic functionality
 */
export const REQUIRED_CONFIG_KEYS: (keyof DevSyncConfig)[] = [];

/**
 * Optional but recommended configuration keys
 */
export const RECOMMENDED_CONFIG_KEYS: (keyof DevSyncConfig)[] = [
  'apiUrl',
  'apiKey',
  'projectId',
];

