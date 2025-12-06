# Advanced AI Features

Comprehensive AI features system for DevSync VS Code extension.

## Features

### ✅ Multiple AI Provider Support
- Provider abstraction layer
- Support for OpenAI, DeepSeek, Anthropic, Ollama, Google, and custom providers
- Easy provider switching
- Provider-specific configuration

### ✅ Context-Aware Suggestions
- Intelligent suggestions based on current context
- Relevance scoring
- Category-based organization
- Actionable suggestions with direct actions

### ✅ Learning from User Corrections
- Pattern extraction from corrections
- Automatic pattern application
- Confidence scoring
- Continuous improvement

### ✅ Custom Prompts
- Create and manage custom prompt templates
- Placeholder support with validation
- Category organization
- Usage tracking

### ✅ AI Model Comparison
- Compare multiple models side-by-side
- Quality, cost, and speed metrics
- Automated recommendations
- Performance benchmarking

### ✅ Cost Tracking
- Per-request cost tracking
- Daily and monthly budgets
- Cost breakdown by provider, model, and type
- Budget alerts

### ✅ Response Caching
- Intelligent caching with TTL
- Cache hit tracking
- Automatic cache cleanup
- Size management

### ✅ Streaming Improvements
- Real-time streaming support
- Chunk-based processing
- Progress tracking
- Better user experience

## Usage

### Basic Usage

```typescript
import { AdvancedAIManager } from './ai';
import { container } from './di/container';

const apiClient = container.getApiClient();
const context = vscode.extensions.getExtension('devsync').extensionContext;
const aiManager = new AdvancedAIManager(apiClient, context);

// Register providers
aiManager.registerProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o-mini',
});

// Query AI
const response = await aiManager.queryAI('Explain this mismatch', 'openai');
```

### Context-Aware Suggestions

```typescript
const context: SuggestionContext = {
  scanReportId: 'scan-123',
  mismatches: [
    { type: 'missing_field', model: 'User', field: 'email' }
  ],
};

const suggestions = await aiManager.generateSuggestions(context);
// Returns relevant suggestions based on context
```

### Custom Prompts

```typescript
// Create custom prompt
await aiManager.createCustomPrompt({
  id: 'my-prompt',
  name: 'My Custom Prompt',
  template: 'Explain {{topic}} in detail',
  placeholders: [
    {
      name: 'topic',
      description: 'Topic to explain',
      required: true,
    },
  ],
  category: 'general',
  active: true,
});

// Use custom prompt
const rendered = aiManager.renderCustomPrompt('my-prompt', {
  topic: 'database indexing',
});
```

### Model Comparison

```typescript
const models = [
  { id: 'gpt-4o-mini', provider: 'openai' },
  { id: 'deepseek-chat', provider: 'deepseek' },
];

const comparison = await aiManager.compareModels(
  models,
  'Explain this schema mismatch'
);

console.log('Best model:', comparison.recommendations[0].model);
```

### Cost Tracking

```typescript
// Get cost summary
const summary = aiManager.getCostSummary('month');
console.log(`Total cost: $${summary.totalCost}`);
console.log(`By provider:`, summary.costByProvider);

// Track cost automatically (done internally)
// Or manually:
await aiManager.trackCost({
  requestId: 'req-123',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  inputTokens: 100,
  outputTokens: 50,
  inputCost: 0.000015,
  outputCost: 0.00003,
  totalCost: 0.000045,
  timestamp: new Date().toISOString(),
  requestType: 'query',
});
```

### Response Caching

```typescript
// Caching is automatic, but you can check cache:
const request: AIRequest = {
  id: 'req-123',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Explain this' }],
};

const cached = aiManager.getCachedResponse(request);
if (cached) {
  console.log('Using cached response');
} else {
  const response = await aiManager.queryAI('Explain this', 'openai');
  await aiManager.cacheResponse(request, response);
}
```

### Streaming

```typescript
const response = await aiManager.queryAIStreaming(
  'Explain this mismatch',
  'openai',
  'gpt-4o-mini',
  (chunk) => {
    console.log('Chunk:', chunk.content);
  }
);
```

### Learning from Corrections

```typescript
await aiManager.recordCorrection({
  id: 'corr-123',
  originalResponse: 'The field is missing',
  correctedResponse: 'The email field is missing from the User table',
  context: {
    scanReportId: 'scan-123',
    mismatches: [{ type: 'missing_field', model: 'User', field: 'email' }],
  },
  timestamp: new Date().toISOString(),
  reason: 'More specific response needed',
});
```

## Type Definitions

All types are exported from `./types`:

- `AIProvider` - Supported AI providers
- `AIModel` - Model information
- `AIProviderConfig` - Provider configuration
- `ContextAwareSuggestion` - Context-aware suggestions
- `UserCorrection` - User corrections for learning
- `CustomPrompt` - Custom prompt templates
- `AIRequestCost` - Cost tracking
- `CostTrackingSummary` - Cost summaries
- `CachedAIResponse` - Cached responses
- `ModelComparisonResult` - Model comparison results
- `AIFeaturesConfig` - Configuration

## Configuration

```typescript
const config: AIFeaturesConfig = {
  defaultProvider: 'openai',
  defaultModels: {
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    // ...
  },
  enableContextSuggestions: true,
  enableLearning: true,
  enableCostTracking: true,
  enableCaching: true,
  cacheTTL: 3600, // 1 hour
  maxCacheSize: 100, // 100 MB
  enableStreaming: true,
  dailyCostBudget: 10.0, // $10/day
  monthlyCostBudget: 100.0, // $100/month
};
```

## Default Prompts

The system includes several default prompts:

1. **Explain Mismatch** - Detailed mismatch explanations
2. **Generate Migration Help** - Migration generation assistance
3. **Optimize Schema** - Schema optimization suggestions
4. **Debug Error** - Error debugging help
5. **Best Practices** - Database best practices

## Architecture

The AI features system is built with:

1. **Provider Abstraction**: Easy to add new AI providers
2. **Context Awareness**: Suggestions based on current state
3. **Learning System**: Improves from user feedback
4. **Cost Management**: Track and control AI costs
5. **Performance**: Caching and streaming for better UX

## Integration

The AI features system integrates with:

- `IApiClient` - For API communication
- `ChatPanelManager` - For chat interface
- `PluginRegistry` - For provider plugins
- `StateStore` - For state management

## Future Enhancements

- [ ] Advanced ML-based learning
- [ ] Multi-model ensemble responses
- [ ] Custom model fine-tuning
- [ ] Advanced cost optimization
- [ ] Response quality scoring
- [ ] Automated prompt optimization

