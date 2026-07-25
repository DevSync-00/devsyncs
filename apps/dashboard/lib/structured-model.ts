import { optionalEnv } from './env';

export interface StructuredModelResult {
  provider: 'openai' | 'deepseek';
  model: string;
  value: unknown;
}

export async function requestStructuredPlan(prompt: string): Promise<StructuredModelResult> {
  const provider = (optionalEnv('AI_PROVIDER') || (optionalEnv('OPENAI_API_KEY') ? 'openai' : 'deepseek')) as 'openai' | 'deepseek';
  const apiKey = provider === 'openai' ? optionalEnv('OPENAI_API_KEY') : optionalEnv('DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error(`${provider === 'openai' ? 'OPENAI_API_KEY' : 'DEEPSEEK_API_KEY'} is not configured.`);
  const baseUrl = provider === 'openai'
    ? optionalEnv('OPENAI_API_URL') || 'https://api.openai.com/v1'
    : optionalEnv('DEEPSEEK_API_URL') || 'https://api.deepseek.com/v1';
  const model = provider === 'openai'
    ? optionalEnv('OPENAI_PLAN_MODEL') || 'gpt-4.1-mini'
    : optionalEnv('DEEPSEEK_PLAN_MODEL') || 'deepseek-chat';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 5000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You enrich evidence-backed database change plans. Follow immutable constraints. Output one JSON object and nothing else.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Model request failed (${response.status} ${response.statusText}).`);
    const body = await response.json() as any;
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('Model returned no structured content.');
    return { provider, model, value: JSON.parse(content) };
  } finally {
    clearTimeout(timeout);
  }
}
