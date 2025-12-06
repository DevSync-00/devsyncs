/**
 * AI features types and interfaces.
 * 
 * Comprehensive type definitions for advanced AI features.
 */

/**
 * AI provider type.
 */
export type AIProvider = 
  | 'openai'
  | 'deepseek'
  | 'anthropic'
  | 'ollama'
  | 'google'
  | 'custom';

/**
 * AI model identifier.
 */
export interface AIModel {
  /**
   * Model ID (e.g., 'gpt-4o-mini', 'deepseek-chat').
   */
  id: string;
  
  /**
   * Provider.
   */
  provider: AIProvider;
  
  /**
   * Model name for display.
   */
  name: string;
  
  /**
   * Model description.
   */
  description?: string;
  
  /**
   * Maximum context window (tokens).
   */
  maxTokens?: number;
  
  /**
   * Cost per 1K input tokens (USD).
   */
  inputCostPer1K?: number;
  
  /**
   * Cost per 1K output tokens (USD).
   */
  outputCostPer1K?: number;
  
  /**
   * Whether model supports streaming.
   */
  supportsStreaming?: boolean;
  
  /**
   * Whether model supports function calling.
   */
  supportsFunctionCalling?: boolean;
  
  /**
   * Model capabilities.
   */
  capabilities?: string[];
}

/**
 * AI provider configuration.
 */
export interface AIProviderConfig {
  /**
   * Provider type.
   */
  provider: AIProvider;
  
  /**
   * API key.
   */
  apiKey: string;
  
  /**
   * Base URL (for custom providers).
   */
  baseUrl?: string;
  
  /**
   * Default model ID.
   */
  defaultModel?: string;
  
  /**
   * Additional configuration.
   */
  config?: Record<string, any>;
}

/**
 * Context-aware suggestion.
 */
export interface ContextAwareSuggestion {
  /**
   * Suggestion ID.
   */
  id: string;
  
  /**
   * Suggestion text.
   */
  text: string;
  
  /**
   * Context that triggered this suggestion.
   */
  context: SuggestionContext;
  
  /**
   * Relevance score (0-1).
   */
  relevance: number;
  
  /**
   * Category.
   */
  category: 'migration' | 'schema' | 'error' | 'optimization' | 'general';
  
  /**
   * Action to take when suggestion is selected.
   */
  action?: SuggestionAction;
}

/**
 * Suggestion context.
 */
export interface SuggestionContext {
  /**
   * Current scan report ID.
   */
  scanReportId?: string;
  
  /**
   * Current migration ID.
   */
  migrationId?: string;
  
  /**
   * Current file path.
   */
  filePath?: string;
  
  /**
   * Current selection/cursor position.
   */
  selection?: {
    start: number;
    end: number;
    text: string;
  };
  
  /**
   * Recent messages in conversation.
   */
  recentMessages?: string[];
  
  /**
   * Detected mismatches.
   */
  mismatches?: Array<{
    type: string;
    model: string;
    field?: string;
  }>;
  
  /**
   * Additional context data.
   */
  metadata?: Record<string, any>;
}

/**
 * Suggestion action.
 */
export interface SuggestionAction {
  /**
   * Action type.
   */
  type: 'query' | 'command' | 'apply_fix' | 'generate_migration' | 'open_doc';
  
  /**
   * Action payload.
   */
  payload: Record<string, any>;
}

/**
 * User correction for learning.
 */
export interface UserCorrection {
  /**
   * Correction ID.
   */
  id: string;
  
  /**
   * Original AI response.
   */
  originalResponse: string;
  
  /**
   * Corrected response.
   */
  correctedResponse: string;
  
  /**
   * Context when correction was made.
   */
  context: SuggestionContext;
  
  /**
   * Timestamp.
   */
  timestamp: string;
  
  /**
   * Correction reason.
   */
  reason?: string;
  
  /**
   * Pattern extracted from correction.
   */
  pattern?: CorrectionPattern;
}

/**
 * Correction pattern for learning.
 */
export interface CorrectionPattern {
  /**
   * Pattern type.
   */
  type: 'response_format' | 'content_accuracy' | 'context_understanding' | 'tone_style';
  
  /**
   * Pattern description.
   */
  description: string;
  
  /**
   * Pattern rules.
   */
  rules: Array<{
    condition: string;
    action: string;
  }>;
  
  /**
   * Confidence score (0-1).
   */
  confidence: number;
}

/**
 * Custom prompt template.
 */
export interface CustomPrompt {
  /**
   * Prompt ID.
   */
  id: string;
  
  /**
   * Prompt name.
   */
  name: string;
  
  /**
   * Prompt description.
   */
  description?: string;
  
  /**
   * Prompt template with placeholders.
   */
  template: string;
  
  /**
   * Placeholder definitions.
   */
  placeholders: PromptPlaceholder[];
  
  /**
   * Category.
   */
  category: 'migration' | 'schema' | 'error' | 'optimization' | 'general';
  
  /**
   * Whether prompt is active.
   */
  active: boolean;
  
  /**
   * Usage count.
   */
  usageCount?: number;
  
  /**
   * Last used timestamp.
   */
  lastUsed?: string;
}

/**
 * Prompt placeholder.
 */
export interface PromptPlaceholder {
  /**
   * Placeholder name (e.g., {{question}}).
   */
  name: string;
  
  /**
   * Placeholder description.
   */
  description: string;
  
  /**
   * Whether placeholder is required.
   */
  required: boolean;
  
  /**
   * Default value.
   */
  defaultValue?: string;
  
  /**
   * Example value.
   */
  example?: string;
}

/**
 * AI request cost tracking.
 */
export interface AIRequestCost {
  /**
   * Request ID.
   */
  requestId: string;
  
  /**
   * Provider.
   */
  provider: AIProvider;
  
  /**
   * Model ID.
   */
  modelId: string;
  
  /**
   * Input tokens.
   */
  inputTokens: number;
  
  /**
   * Output tokens.
   */
  outputTokens: number;
  
  /**
   * Input cost (USD).
   */
  inputCost: number;
  
  /**
   * Output cost (USD).
   */
  outputCost: number;
  
  /**
   * Total cost (USD).
   */
  totalCost: number;
  
  /**
   * Timestamp.
   */
  timestamp: string;
  
  /**
   * Request type.
   */
  requestType: 'query' | 'explain' | 'generate' | 'analyze';
}

/**
 * Cost tracking summary.
 */
export interface CostTrackingSummary {
  /**
   * Total requests.
   */
  totalRequests: number;
  
  /**
   * Total cost (USD).
   */
  totalCost: number;
  
  /**
   * Cost by provider.
   */
  costByProvider: Record<AIProvider, number>;
  
  /**
   * Cost by model.
   */
  costByModel: Record<string, number>;
  
  /**
   * Cost by request type.
   */
  costByType: Record<string, number>;
  
  /**
   * Daily costs.
   */
  dailyCosts: Array<{
    date: string;
    cost: number;
    requests: number;
  }>;
  
  /**
   * Period start.
   */
  periodStart: string;
  
  /**
   * Period end.
   */
  periodEnd: string;
}

/**
 * Cached AI response.
 */
export interface CachedAIResponse {
  /**
   * Cache key (hash of request).
   */
  cacheKey: string;
  
  /**
   * Original request.
   */
  request: AIRequest;
  
  /**
   * Cached response.
   */
  response: AIResponse;
  
  /**
   * Cache timestamp.
   */
  cachedAt: string;
  
  /**
   * Expiration timestamp.
   */
  expiresAt: string;
  
  /**
   * Hit count.
   */
  hitCount: number;
  
  /**
   * Last accessed timestamp.
   */
  lastAccessed: string;
}

/**
 * AI request.
 */
export interface AIRequest {
  /**
   * Request ID.
   */
  id: string;
  
  /**
   * Provider.
   */
  provider: AIProvider;
  
  /**
   * Model ID.
   */
  modelId: string;
  
  /**
   * Prompt/messages.
   */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  
  /**
   * Temperature.
   */
  temperature?: number;
  
  /**
   * Max tokens.
   */
  maxTokens?: number;
  
  /**
   * Additional parameters.
   */
  parameters?: Record<string, any>;
}

/**
 * AI response.
 */
export interface AIResponse {
  /**
   * Response ID.
   */
  id: string;
  
  /**
   * Request ID.
   */
  requestId: string;
  
  /**
   * Response content.
   */
  content: string;
  
  /**
   * Input tokens used.
   */
  inputTokens: number;
  
  /**
   * Output tokens used.
   */
  outputTokens: number;
  
  /**
   * Finish reason.
   */
  finishReason?: string;
  
  /**
   * Response metadata.
   */
  metadata?: Record<string, any>;
}

/**
 * Streaming chunk.
 */
export interface StreamingChunk {
  /**
   * Chunk ID.
   */
  id: string;
  
  /**
   * Request ID.
   */
  requestId: string;
  
  /**
   * Chunk content.
   */
  content: string;
  
  /**
   * Chunk index.
   */
  index: number;
  
  /**
   * Whether this is the last chunk.
   */
  done: boolean;
  
  /**
   * Chunk metadata.
   */
  metadata?: Record<string, any>;
}

/**
 * Model comparison result.
 */
export interface ModelComparisonResult {
  /**
   * Models compared.
   */
  models: AIModel[];
  
  /**
   * Comparison metrics.
   */
  metrics: {
    /**
     * Response quality scores (0-1).
     */
    quality: Record<string, number>;
    
    /**
     * Response times (ms).
     */
    responseTime: Record<string, number>;
    
    /**
     * Costs (USD).
     */
    cost: Record<string, number>;
    
    /**
     * Token usage.
     */
    tokens: Record<string, {
      input: number;
      output: number;
    }>;
  };
  
  /**
   * Recommendations.
   */
  recommendations: Array<{
    model: string;
    reason: string;
    score: number;
  }>;
}

/**
 * AI features configuration.
 */
export interface AIFeaturesConfig {
  /**
   * Default provider.
   */
  defaultProvider: AIProvider;
  
  /**
   * Default model per provider.
   */
  defaultModels: Record<AIProvider, string>;
  
  /**
   * Enable context-aware suggestions.
   */
  enableContextSuggestions: boolean;
  
  /**
   * Enable learning from corrections.
   */
  enableLearning: boolean;
  
  /**
   * Enable cost tracking.
   */
  enableCostTracking: boolean;
  
  /**
   * Enable response caching.
   */
  enableCaching: boolean;
  
  /**
   * Cache TTL (seconds).
   */
  cacheTTL: number;
  
  /**
   * Max cache size (MB).
   */
  maxCacheSize: number;
  
  /**
   * Enable streaming.
   */
  enableStreaming: boolean;
  
  /**
   * Cost budget per day (USD).
   */
  dailyCostBudget?: number;
  
  /**
   * Cost budget per month (USD).
   */
  monthlyCostBudget?: number;
}

