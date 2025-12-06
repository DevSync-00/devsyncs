/**
 * Advanced AI features manager.
 * 
 * Implements comprehensive AI features:
 * - Multiple AI provider support
 * - Context-aware suggestions
 * - Learning from user corrections
 * - Custom prompts
 * - AI model comparison
 * - Cost tracking
 * - Response caching
 * - Streaming improvements
 */

import * as vscode from 'vscode';
import { IApiClient } from '../interfaces';
import {
  AIProvider,
  AIModel,
  AIProviderConfig,
  ContextAwareSuggestion,
  SuggestionContext,
  UserCorrection,
  CorrectionPattern,
  CustomPrompt,
  AIRequestCost,
  CostTrackingSummary,
  CachedAIResponse,
  AIRequest,
  AIResponse,
  StreamingChunk,
  ModelComparisonResult,
  AIFeaturesConfig,
} from './types';

/**
 * Advanced AI manager.
 */
export class AdvancedAIManager {
  private providers: Map<AIProvider, AIProviderConfig> = new Map();
  private models: Map<string, AIModel> = new Map();
  private corrections: UserCorrection[] = [];
  private customPrompts: Map<string, CustomPrompt> = new Map();
  private costHistory: AIRequestCost[] = [];
  private cache: Map<string, CachedAIResponse> = new Map();
  private config: AIFeaturesConfig;

  constructor(
    private readonly apiClient: IApiClient,
    private readonly context: vscode.ExtensionContext
  ) {
    this.config = this.loadConfig();
    this.initializeDefaultModels();
    this.loadCorrections();
    this.loadCustomPrompts();
    this.loadCostHistory();
  }

  /**
   * Registers an AI provider.
   */
  registerProvider(config: AIProviderConfig): void {
    this.providers.set(config.provider, config);
  }

  /**
   * Gets available providers.
   */
  getProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Gets available models for a provider.
   */
  getModels(provider: AIProvider): AIModel[] {
    return Array.from(this.models.values()).filter(m => m.provider === provider);
  }

  /**
   * Gets all available models.
   */
  getAllModels(): AIModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Generates context-aware suggestions.
   */
  async generateSuggestions(context: SuggestionContext): Promise<ContextAwareSuggestion[]> {
    if (!this.config.enableContextSuggestions) {
      return [];
    }

    const suggestions: ContextAwareSuggestion[] = [];

    // Analyze context to generate suggestions
    if (context.mismatches && context.mismatches.length > 0) {
      // Suggest migration generation
      suggestions.push({
        id: 'suggest-migration',
        text: `Generate migration for ${context.mismatches.length} mismatch(es)`,
        context,
        relevance: 0.9,
        category: 'migration',
        action: {
          type: 'generate_migration',
          payload: { scanReportId: context.scanReportId },
        },
      });

      // Suggest specific fixes
      for (const mismatch of context.mismatches) {
        if (mismatch.type === 'missing_field') {
          suggestions.push({
            id: `suggest-add-field-${mismatch.model}-${mismatch.field}`,
            text: `Add missing field '${mismatch.field}' to '${mismatch.model}'`,
            context,
            relevance: 0.85,
            category: 'schema',
            action: {
              type: 'apply_fix',
              payload: { mismatch },
            },
          });
        }
      }
    }

    // Suggest based on recent messages
    if (context.recentMessages && context.recentMessages.length > 0) {
      const lastMessage = context.recentMessages[context.recentMessages.length - 1];
      if (lastMessage.toLowerCase().includes('error')) {
        suggestions.push({
          id: 'suggest-error-help',
          text: 'Get help understanding this error',
          context,
          relevance: 0.7,
          category: 'error',
          action: {
            type: 'query',
            payload: { question: `Explain this error: ${lastMessage}` },
          },
        });
      }
    }

    // Apply learning from corrections
    const learnedSuggestions = this.applyLearnedPatterns(suggestions, context);
    suggestions.push(...learnedSuggestions);

    // Sort by relevance
    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Records a user correction for learning.
   */
  async recordCorrection(correction: UserCorrection): Promise<void> {
    this.corrections.push(correction);
    
    // Extract pattern from correction
    const pattern = this.extractPattern(correction);
    if (pattern) {
      correction.pattern = pattern;
    }

    // Save corrections
    await this.saveCorrections();

    // Update learning patterns
    await this.updateLearningPatterns();
  }

  /**
   * Creates a custom prompt.
   */
  async createCustomPrompt(prompt: CustomPrompt): Promise<void> {
    this.customPrompts.set(prompt.id, prompt);
    await this.saveCustomPrompts();
  }

  /**
   * Gets custom prompts.
   */
  getCustomPrompts(category?: string): CustomPrompt[] {
    const prompts = Array.from(this.customPrompts.values());
    if (category) {
      return prompts.filter(p => p.category === category);
    }
    return prompts;
  }

  /**
   * Renders a custom prompt with values.
   */
  renderCustomPrompt(promptId: string, values: Record<string, string>): string {
    const prompt = this.customPrompts.get(promptId);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`);
    }

    let rendered = prompt.template;

    // Replace placeholders
    for (const placeholder of prompt.placeholders) {
      const value = values[placeholder.name] || placeholder.defaultValue || '';
      if (placeholder.required && !value) {
        throw new Error(`Required placeholder missing: ${placeholder.name}`);
      }
      rendered = rendered.replace(
        new RegExp(`\\{\\{${placeholder.name}\\}\\}`, 'g'),
        value
      );
    }

    // Update usage
    prompt.usageCount = (prompt.usageCount || 0) + 1;
    prompt.lastUsed = new Date().toISOString();
    this.saveCustomPrompts();

    return rendered;
  }

  /**
   * Compares AI models.
   */
  async compareModels(
    models: AIModel[],
    testPrompt: string
  ): Promise<ModelComparisonResult> {
    const metrics = {
      quality: {} as Record<string, number>,
      responseTime: {} as Record<string, number>,
      cost: {} as Record<string, number>,
      tokens: {} as Record<string, { input: number; output: number }>,
    };

    const recommendations: Array<{ model: string; reason: string; score: number }> = [];

    // Test each model
    for (const model of models) {
      const startTime = Date.now();
      
      try {
        const response = await this.queryAI(testPrompt, model.provider, model.id);
        const responseTime = Date.now() - startTime;

        // Calculate metrics
        metrics.responseTime[model.id] = responseTime;
        metrics.tokens[model.id] = {
          input: response.inputTokens,
          output: response.outputTokens,
        };

        // Calculate cost
        const inputCost = (response.inputTokens / 1000) * (model.inputCostPer1K || 0);
        const outputCost = (response.outputTokens / 1000) * (model.outputCostPer1K || 0);
        metrics.cost[model.id] = inputCost + outputCost;

        // Quality score (simplified - would use more sophisticated evaluation)
        metrics.quality[model.id] = this.evaluateResponseQuality(response.content);

        // Track cost
        await this.trackCost({
          requestId: response.id,
          provider: model.provider,
          modelId: model.id,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          inputCost,
          outputCost,
          totalCost: inputCost + outputCost,
          timestamp: new Date().toISOString(),
          requestType: 'query',
        });
      } catch (error) {
        // Model failed
        metrics.quality[model.id] = 0;
        metrics.responseTime[model.id] = -1;
        metrics.cost[model.id] = 0;
      }
    }

    // Generate recommendations
    for (const model of models) {
      const quality = metrics.quality[model.id] || 0;
      const cost = metrics.cost[model.id] || 0;
      const responseTime = metrics.responseTime[model.id] || 0;

      // Score based on quality, cost, and speed
      const score = (quality * 0.5) + ((1 / (cost + 0.001)) * 0.3) + ((1 / (responseTime + 1)) * 0.2);

      recommendations.push({
        model: model.id,
        reason: this.generateRecommendationReason(quality, cost, responseTime),
        score,
      });
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return {
      models,
      metrics,
      recommendations,
    };
  }

  /**
   * Tracks AI request cost.
   */
  async trackCost(cost: AIRequestCost): Promise<void> {
    if (!this.config.enableCostTracking) {
      return;
    }

    this.costHistory.push(cost);
    
    // Check budget limits
    await this.checkBudgetLimits();

    // Save cost history
    await this.saveCostHistory();
  }

  /**
   * Gets cost tracking summary.
   */
  getCostSummary(period: 'day' | 'week' | 'month' = 'month'): CostTrackingSummary {
    const now = new Date();
    const periodStart = new Date();
    
    switch (period) {
      case 'day':
        periodStart.setDate(now.getDate() - 1);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
    }

    const periodCosts = this.costHistory.filter(
      c => new Date(c.timestamp) >= periodStart
    );

    const costByProvider: Record<AIProvider, number> = {} as Record<AIProvider, number>;
    const costByModel: Record<string, number> = {};
    const costByType: Record<string, number> = {};

    let totalCost = 0;

    for (const cost of periodCosts) {
      totalCost += cost.totalCost;
      costByProvider[cost.provider] = (costByProvider[cost.provider] || 0) + cost.totalCost;
      costByModel[cost.modelId] = (costByModel[cost.modelId] || 0) + cost.totalCost;
      costByType[cost.requestType] = (costByType[cost.requestType] || 0) + cost.totalCost;
    }

    // Group by day
    const dailyCosts = this.groupCostsByDay(periodCosts);

    return {
      totalRequests: periodCosts.length,
      totalCost,
      costByProvider,
      costByModel,
      costByType,
      dailyCosts,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
    };
  }

  /**
   * Caches AI response.
   */
  async cacheResponse(
    request: AIRequest,
    response: AIResponse
  ): Promise<void> {
    if (!this.config.enableCaching) {
      return;
    }

    const cacheKey = this.generateCacheKey(request);
    const expiresAt = new Date(Date.now() + this.config.cacheTTL * 1000);

    const cached: CachedAIResponse = {
      cacheKey,
      request,
      response,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0,
      lastAccessed: new Date().toISOString(),
    };

    this.cache.set(cacheKey, cached);
    await this.cleanupCache();
  }

  /**
   * Gets cached response if available.
   */
  getCachedResponse(request: AIRequest): AIResponse | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check expiration
    if (new Date(cached.expiresAt) < new Date()) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access info
    cached.hitCount++;
    cached.lastAccessed = new Date().toISOString();

    return cached.response;
  }

  /**
   * Queries AI with streaming support.
   */
  async queryAIStreaming(
    prompt: string,
    provider: AIProvider = this.config.defaultProvider,
    modelId?: string,
    onChunk?: (chunk: StreamingChunk) => void
  ): Promise<AIResponse> {
    const model = modelId || this.config.defaultModels[provider];
    const request: AIRequest = {
      id: this.generateRequestId(),
      provider,
      modelId: model,
      messages: [{ role: 'user', content: prompt }],
    };

    // Check cache first
    const cached = this.getCachedResponse(request);
    if (cached) {
      return cached;
    }

    // Stream response
    const response = await this.streamAIResponse(request, onChunk);

    // Cache response
    await this.cacheResponse(request, response);

    // Track cost
    const modelInfo = this.models.get(model);
    if (modelInfo) {
      const inputCost = (response.inputTokens / 1000) * (modelInfo.inputCostPer1K || 0);
      const outputCost = (response.outputTokens / 1000) * (modelInfo.outputCostPer1K || 0);
      
      await this.trackCost({
        requestId: response.id,
        provider,
        modelId: model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        timestamp: new Date().toISOString(),
        requestType: 'query',
      });
    }

    return response;
  }

  /**
   * Queries AI (non-streaming).
   */
  async queryAI(
    prompt: string,
    provider: AIProvider = this.config.defaultProvider,
    modelId?: string
  ): Promise<AIResponse> {
    return this.queryAIStreaming(prompt, provider, modelId);
  }

  // Private helper methods

  private loadConfig(): AIFeaturesConfig {
    const config = this.context.globalState.get<AIFeaturesConfig>('ai.config');
    return config || {
      defaultProvider: 'openai',
      defaultModels: {
        openai: 'gpt-4o-mini',
        deepseek: 'deepseek-chat',
        anthropic: 'claude-3-haiku',
        ollama: 'llama3.2:3b',
        google: 'gemini-pro',
        custom: 'custom',
      },
      enableContextSuggestions: true,
      enableLearning: true,
      enableCostTracking: true,
      enableCaching: true,
      cacheTTL: 3600, // 1 hour
      maxCacheSize: 100, // 100 MB
      enableStreaming: true,
    };
  }

  private getConfigValue<K extends keyof AIFeaturesConfig>(
    key: K
  ): AIFeaturesConfig[K] {
    return this.config[key];
  }

  private initializeDefaultModels(): void {
    // OpenAI models
    this.models.set('gpt-4o-mini', {
      id: 'gpt-4o-mini',
      provider: 'openai',
      name: 'GPT-4o Mini',
      description: 'Fast and efficient model',
      maxTokens: 128000,
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
      supportsStreaming: true,
      supportsFunctionCalling: true,
    });

    // DeepSeek models
    this.models.set('deepseek-chat', {
      id: 'deepseek-chat',
      provider: 'deepseek',
      name: 'DeepSeek Chat',
      description: 'Cost-effective alternative',
      maxTokens: 32000,
      inputCostPer1K: 0.00014,
      outputCostPer1K: 0.00028,
      supportsStreaming: true,
      supportsFunctionCalling: true,
    });

    // Add more models as needed
  }

  private async loadCorrections(): Promise<void> {
    const stored = this.context.globalState.get<UserCorrection[]>('ai.corrections');
    if (stored) {
      this.corrections = stored;
    }
  }

  private async saveCorrections(): Promise<void> {
    await this.context.globalState.update('ai.corrections', this.corrections);
  }

  private async loadCustomPrompts(): Promise<void> {
    const stored = this.context.globalState.get<CustomPrompt[]>('ai.customPrompts');
    if (stored) {
      for (const prompt of stored) {
        this.customPrompts.set(prompt.id, prompt);
      }
    }
  }

  private async saveCustomPrompts(): Promise<void> {
    const prompts = Array.from(this.customPrompts.values());
    await this.context.globalState.update('ai.customPrompts', prompts);
  }

  private async loadCostHistory(): Promise<void> {
    const stored = this.context.globalState.get<AIRequestCost[]>('ai.costHistory');
    if (stored) {
      this.costHistory = stored;
    }
  }

  private async saveCostHistory(): Promise<void> {
    // Keep only last 1000 entries
    if (this.costHistory.length > 1000) {
      this.costHistory = this.costHistory.slice(-1000);
    }
    await this.context.globalState.update('ai.costHistory', this.costHistory);
  }

  private extractPattern(correction: UserCorrection): CorrectionPattern | undefined {
    // Simple pattern extraction - would be more sophisticated in production
    const original = correction.originalResponse.toLowerCase();
    const corrected = correction.correctedResponse.toLowerCase();

    // Detect format changes
    if (original !== corrected && original.length > 0) {
      return {
        type: 'content_accuracy',
        description: 'Response accuracy improvement',
        rules: [
          {
            condition: 'similar_context',
            action: 'use_corrected_format',
          },
        ],
        confidence: 0.7,
      };
    }

    return undefined;
  }

  private applyLearnedPatterns(
    suggestions: ContextAwareSuggestion[],
    context: SuggestionContext
  ): ContextAwareSuggestion[] {
    const learned: ContextAwareSuggestion[] = [];

    // Apply patterns from corrections
    for (const correction of this.corrections) {
      if (correction.pattern && this.matchesContext(correction.context, context)) {
        // Generate suggestion based on learned pattern
        learned.push({
          id: `learned-${correction.id}`,
          text: `Based on previous corrections: ${correction.pattern.description}`,
          context,
          relevance: correction.pattern.confidence,
          category: 'general',
        });
      }
    }

    return learned;
  }

  private matchesContext(context1: SuggestionContext, context2: SuggestionContext): boolean {
    // Simple context matching - would be more sophisticated in production
    if (context1.scanReportId === context2.scanReportId) {
      return true;
    }
    if (context1.mismatches && context2.mismatches &&
        context1.mismatches.length > 0 && context2.mismatches.length > 0) {
      return true;
    }
    return false;
  }

  private async updateLearningPatterns(): Promise<void> {
    // Update learning patterns based on corrections
    // This would involve more sophisticated ML in production
  }

  private evaluateResponseQuality(content: string): number {
    // Simple quality evaluation - would use more sophisticated metrics
    const length = content.length;
    const hasCode = content.includes('```');
    const hasStructure = content.includes('\n') || content.includes('-');
    
    let score = 0.5; // Base score
    
    if (length > 100) score += 0.2;
    if (hasCode) score += 0.15;
    if (hasStructure) score += 0.15;
    
    return Math.min(1.0, score);
  }

  private generateRecommendationReason(
    quality: number,
    cost: number,
    responseTime: number
  ): string {
    const reasons: string[] = [];
    
    if (quality > 0.8) reasons.push('high quality');
    if (cost < 0.001) reasons.push('low cost');
    if (responseTime < 1000) reasons.push('fast response');
    
    return reasons.length > 0 ? reasons.join(', ') : 'balanced performance';
  }

  private async checkBudgetLimits(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todayCosts = this.costHistory.filter(
      c => c.timestamp.startsWith(today)
    );
    const todayTotal = todayCosts.reduce((sum, c) => sum + c.totalCost, 0);

    if (this.config.dailyCostBudget && todayTotal >= this.config.dailyCostBudget) {
      vscode.window.showWarningMessage(
        `Daily AI cost budget reached: $${todayTotal.toFixed(4)}`
      );
    }

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthCosts = this.costHistory.filter(
      c => c.timestamp.startsWith(thisMonth)
    );
    const monthTotal = monthCosts.reduce((sum, c) => sum + c.totalCost, 0);

    if (this.config.monthlyCostBudget && monthTotal >= this.config.monthlyCostBudget) {
      vscode.window.showWarningMessage(
        `Monthly AI cost budget reached: $${monthTotal.toFixed(4)}`
      );
    }
  }

  private groupCostsByDay(costs: AIRequestCost[]): Array<{ date: string; cost: number; requests: number }> {
    const byDay = new Map<string, { cost: number; requests: number }>();

    for (const cost of costs) {
      const date = cost.timestamp.split('T')[0];
      const existing = byDay.get(date) || { cost: 0, requests: 0 };
      existing.cost += cost.totalCost;
      existing.requests += 1;
      byDay.set(date, existing);
    }

    return Array.from(byDay.entries()).map(([date, data]) => ({
      date,
      cost: data.cost,
      requests: data.requests,
    }));
  }

  private generateCacheKey(request: AIRequest): string {
    // Generate hash from request
    const key = JSON.stringify({
      provider: request.provider,
      modelId: request.modelId,
      messages: request.messages,
    });
    // Simple hash - would use proper hashing in production
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  private async cleanupCache(): Promise<void> {
    // Remove expired entries
    const now = new Date();
    for (const [key, cached] of this.cache.entries()) {
      if (new Date(cached.expiresAt) < now) {
        this.cache.delete(key);
      }
    }

    // Check size limit (simplified)
    if (this.cache.size > 100) {
      // Remove least recently used
      const sorted = Array.from(this.cache.entries())
        .sort((a, b) => 
          new Date(a[1].lastAccessed).getTime() - new Date(b[1].lastAccessed).getTime()
        );
      
      for (let i = 0; i < sorted.length - 100; i++) {
        this.cache.delete(sorted[i][0]);
      }
    }
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async streamAIResponse(
    request: AIRequest,
    onChunk?: (chunk: StreamingChunk) => void
  ): Promise<AIResponse> {
    // This would integrate with actual AI provider streaming API
    // For now, return a mock response
    const response: AIResponse = {
      id: this.generateRequestId(),
      requestId: request.id,
      content: 'Mock AI response',
      inputTokens: 10,
      outputTokens: 20,
    };

    // Simulate streaming
    if (onChunk && this.config.enableStreaming) {
      const words = response.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        onChunk({
          id: `chunk-${i}`,
          requestId: request.id,
          content: words[i] + ' ',
          index: i,
          done: i === words.length - 1,
        });
      }
    }

    return response;
  }
}

