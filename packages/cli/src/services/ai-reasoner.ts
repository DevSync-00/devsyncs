/**
 * AI Reasoning Layer (Phase 6)
 * 
 * Provides structured, explainable AI reasoning about schema conflicts.
 * 
 * Per charter requirements:
 * - Use only user-provided API keys
 * - Never send code/schema without explicit user intent
 * - All AI output must be structured, explainable, deterministic where possible
 * - No black-box actions
 * - Explanation-first responses
 */

import type { ConflictReport, Conflict } from './conflict-detector.js';
import type { CanonicalSchema } from './schema-normalizer.js';

export interface ReasoningOptions {
  provider?: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string; // User-provided API key
  model?: string; // Model identifier (e.g., 'gpt-4', 'claude-3-opus', 'llama3.2')
  ollamaUrl?: string; // For Ollama (local)
  maxTokens?: number;
  temperature?: number; // Lower for more deterministic outputs
}

export interface ConflictExplanation {
  conflictId: string;
  explanation: string; // Human-readable explanation of why this conflict exists
  rootCause: string; // Brief root cause analysis
  impact: string; // Expected impact if not fixed
  recommendedAction: string; // Recommended fix approach
  safetyNotes?: string; // Safety considerations
}

export interface ReasoningResult {
  explanations: ConflictExplanation[];
  summary: {
    totalConflicts: number;
    explained: number;
    highRiskCount: number;
    recommendedPriority: string[]; // Conflict IDs in recommended fix order
  };
  metadata: {
    model: string;
    provider: string;
    timestamp: Date;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

/**
 * Generate AI reasoning for conflicts
 * 
 * Only processes conflicts that user has explicitly requested reasoning for.
 * Requires user-provided API key (never uses service-configured keys).
 */
export async function reasonAboutConflicts(
  conflictReport: ConflictReport,
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema,
  options: ReasoningOptions = {}
): Promise<ReasoningResult> {
  // Safety: Require explicit API key (user-provided)
  if (!options.apiKey && options.provider !== 'ollama') {
    throw new Error(
      'API key required for AI reasoning. Provide user API key via config or --api-key flag.'
    );
  }

  // Use structured prompt for deterministic outputs
  const prompt = buildReasoningPrompt(conflictReport, codeSchema, dbSchema);

  // Call AI provider
  const rawResponse = await callAIProvider(prompt, options);

  // Parse structured response
  const explanations = parseStructuredResponse(rawResponse, conflictReport.conflicts);

  // Build summary
  const highRiskCount = conflictReport.summary.byRisk.high;
  const recommendedPriority = determineFixPriority(explanations, conflictReport);

  return {
    explanations,
    summary: {
      totalConflicts: conflictReport.conflicts.length,
      explained: explanations.length,
      highRiskCount,
      recommendedPriority,
    },
    metadata: {
      model: options.model || 'default',
      provider: options.provider || 'openai',
      timestamp: new Date(),
    },
  };
}

/**
 * Build structured prompt for AI reasoning
 */
function buildReasoningPrompt(
  conflictReport: ConflictReport,
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): string {
  // Focus on high and medium risk conflicts
  const significantConflicts = conflictReport.conflicts.filter(
    (c) => c.risk === 'high' || c.risk === 'medium'
  );

  // Build schema summary (minimal context)
  const codeSchemaSummary = {
    tables: codeSchema.tables.length,
    source: codeSchema.metadata.sourceType,
  };

  const dbSchemaSummary = {
    tables: dbSchema.tables.length,
    source: dbSchema.metadata.sourceType,
  };

  return `You are a database schema expert. Analyze the following schema conflicts and provide structured explanations.

SCHEMA CONTEXT:
- Code schema: ${codeSchemaSummary.tables} tables (source: ${codeSchemaSummary.source})
- Database schema: ${dbSchemaSummary.tables} tables (source: ${dbSchemaSummary.source})

CONFLICTS TO ANALYZE (${significantConflicts.length} conflicts):
${significantConflicts
  .map(
    (c, idx) => `
${idx + 1}. [${c.risk.toUpperCase()} RISK] ${c.category} conflict
   Table: ${c.table}${c.column ? `, Column: ${c.column}` : ''}
   Type: ${c.type}
   Message: ${c.message}
   ${c.explanation ? `Current explanation: ${c.explanation}` : ''}
`
  )
  .join('\n')}

REQUIRED OUTPUT FORMAT (JSON):
{
  "explanations": [
    {
      "conflictId": "<conflict-id>",
      "explanation": "<clear, concise explanation of why this conflict exists>",
      "rootCause": "<brief root cause: migration-not-applied | schema-drift | type-mismatch | constraint-missing | etc.>",
      "impact": "<expected impact if not fixed: runtime-errors | data-loss | performance-degradation | unexpected-behavior | none>",
      "recommendedAction": "<recommended fix approach: add-migration | alter-column | add-constraint | manual-review | etc.>",
      "safetyNotes": "<any safety considerations>"
    }
  ]
}

GUIDELINES:
- Be specific and actionable
- Focus on practical root causes (migrations, schema drift, etc.)
- Recommend safe fixes
- Note any data safety considerations
- Keep explanations concise (2-3 sentences max)

Respond with ONLY valid JSON, no markdown formatting.`;
}

/**
 * Call AI provider with structured prompt
 */
async function callAIProvider(
  prompt: string,
  options: ReasoningOptions
): Promise<string> {
  const provider = options.provider || 'openai';
  const model = options.model || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus');
  const temperature = options.temperature ?? 0.3; // Lower temperature for more deterministic outputs

  if (provider === 'ollama') {
    return await callOllama(prompt, model, options.ollamaUrl || 'http://localhost:11434', temperature);
  }

  if (provider === 'openai') {
    return await callOpenAI(prompt, model, options.apiKey!, temperature, options.maxTokens);
  }

  if (provider === 'anthropic') {
    return await callAnthropic(prompt, model, options.apiKey!, temperature, options.maxTokens);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  prompt: string,
  model: string,
  apiKey: string,
  temperature: number,
  maxTokens?: number
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a database schema expert. Always respond with valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens || 2000,
      response_format: { type: 'json_object' }, // Force JSON output
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json() as any;
  return data?.choices?.[0]?.message?.content || '{}';
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  prompt: string,
  model: string,
  apiKey: string,
  temperature: number,
  maxTokens?: number
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-opus-20240229',
      max_tokens: maxTokens || 2000,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json() as any;
  return data?.content?.[0]?.text || '{}';
}

/**
 * Call Ollama (local)
 */
async function callOllama(
  prompt: string,
  model: string,
  ollamaUrl: string,
  temperature: number
): Promise<string> {
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${error}`);
  }

  const data = await response.json() as any;
  return data?.response || '{}';
}

/**
 * Parse structured AI response
 */
function parseStructuredResponse(
  rawResponse: string,
  conflicts: Conflict[]
): ConflictExplanation[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = rawResponse.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    const explanations: ConflictExplanation[] = parsed.explanations || [];

    // Validate and enrich with conflict data
    const conflictMap = new Map(conflicts.map((c) => [c.id, c]));

    return explanations
      .filter((exp: any) => conflictMap.has(exp.conflictId))
      .map((exp: any) => ({
        conflictId: exp.conflictId,
        explanation: exp.explanation || 'No explanation provided',
        rootCause: exp.rootCause || 'unknown',
        impact: exp.impact || 'unknown',
        recommendedAction: exp.recommendedAction || 'manual-review',
        safetyNotes: exp.safetyNotes,
      }));
  } catch (error) {
    // If parsing fails, return minimal explanations
    console.warn(`Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`);
    return conflicts
      .filter((c) => c.risk === 'high' || c.risk === 'medium')
      .map((c) => ({
        conflictId: c.id,
        explanation: c.explanation || c.message,
        rootCause: 'parsing-error',
        impact: c.risk === 'high' ? 'runtime-errors' : 'unexpected-behavior',
        recommendedAction: 'manual-review',
        safetyNotes: 'AI reasoning unavailable - manual review recommended',
      }));
  }
}

/**
 * Determine recommended fix priority
 */
function determineFixPriority(
  explanations: ConflictExplanation[],
  conflictReport: ConflictReport
): string[] {
  // Sort by risk, then by impact severity
  const impactOrder = {
    'runtime-errors': 0,
    'data-loss': 1,
    'performance-degradation': 2,
    'unexpected-behavior': 3,
    'none': 4,
  };

  return conflictReport.conflicts
    .filter((c) => c.risk === 'high' || c.risk === 'medium')
    .sort((a, b) => {
      const aExp = explanations.find((e) => e.conflictId === a.id);
      const bExp = explanations.find((e) => e.conflictId === b.id);
      const aImpact = aExp ? impactOrder[aExp.impact as keyof typeof impactOrder] ?? 99 : 99;
      const bImpact = bExp ? impactOrder[bExp.impact as keyof typeof impactOrder] ?? 99 : 99;
      if (aImpact !== bImpact) return aImpact - bImpact;
      if (a.risk !== b.risk) return a.risk === 'high' ? -1 : 1;
      return a.table.localeCompare(b.table);
    })
    .map((c) => c.id);
}

