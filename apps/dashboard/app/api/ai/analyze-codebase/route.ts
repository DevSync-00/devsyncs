import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Validate device flow token (base64-encoded JSON)
 * Returns userId if valid, null otherwise
 */
function validateDeviceFlowToken(token: string): string | null {
  try {
    // Decode base64url token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const payload = JSON.parse(decoded);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }
    
    // Return user ID from token
    return payload.sub || null;
  } catch {
    return null; // Invalid token format
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Try Supabase JWT validation first
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
      
      if (!tokenError && tokenUser) {
        userId = tokenUser.id;
      } else {
        // Fallback: try device flow token validation
        userId = validateDeviceFlowToken(token);
      }
    } else {
      // Try session-based auth
      const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser();
      
      if (!authError && sessionUser) {
        userId = sessionUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { files, basePath } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'files array is required' },
        { status: 400 }
      );
    }

    // Get AI provider configuration from request or environment
    const { provider } = body;
    const aiProvider = provider || process.env.AI_PROVIDER || 'puter';
    
    // Get API key and base URL based on provider
    let apiKey: string | undefined;
    let baseUrl: string | undefined;
    
    if (aiProvider === 'puter') {
      // Puter.js uses OpenRouter API - no API key required (user-pays model)
      baseUrl = 'https://openrouter.ai/api/v1';
      // No API key needed for Puter.js
    } else if (aiProvider === 'deepseek') {
      apiKey = process.env.DEEPSEEK_API_KEY;
      baseUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
      
      // Debug logging
      console.log('[AI Analyze] DeepSeek config check:', {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        baseUrl,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('DEEPSEEK'))
      });
      
      if (!apiKey) {
        console.error('[AI Analyze] DeepSeek API key not configured');
        return NextResponse.json(
          { 
            error: 'DeepSeek API key not configured on server',
            details: 'Please add DEEPSEEK_API_KEY to your server environment variables (apps/dashboard/.env.local) and restart the server'
          },
          { status: 500 }
        );
      }
    } else {
      // OpenAI (explicit selection only)
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
      if (!apiKey) {
        console.error('[AI Analyze] OpenAI API key not configured');
        return NextResponse.json(
          { 
            error: 'OpenAI API key not configured on server',
            details: 'Please add OPENAI_API_KEY to your server environment variables (apps/dashboard/.env.local)'
          },
          { status: 500 }
        );
      }
    }

    // Build prompt for AI analysis
    const fileSummaries = files.map((file: any, index: number) => {
      const relativePath = file.path || `file${index + 1}`;
      const preview = file.content?.slice(0, 2000) || '';
      return `File ${index + 1}: ${relativePath}\n\`\`\`\n${preview}\n\`\`\``;
    }).join('\n\n');

    const prompt = `Analyze this codebase and infer the expected database schema.

Focus on:
1. Database queries (SELECT, INSERT, UPDATE, DELETE)
2. ORM model definitions (Prisma, TypeORM, Sequelize, etc.)
3. Table references in code
4. Field access patterns (model.field)
5. Type definitions that indicate database structure

Code files:
${fileSummaries}

Return a JSON object with this structure:
{
  "models": [
    {
      "name": "table_name",
      "fields": [
        {
          "name": "field_name",
          "type": "postgresql_type",
          "nullable": true/false,
          "primaryKey": true/false
        }
      ]
    }
  ]
}

Only include tables that are clearly referenced or defined in the code.`;

    // Determine model based on provider
    let model: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (aiProvider === 'puter') {
      // Puter.js uses Codex Max model via OpenRouter
      model = 'openai/gpt-5.1-codex-max';
      // No API key needed for Puter.js (user-pays model)
      headers['HTTP-Referer'] = 'https://Dev-Sync.dev';
      headers['X-Title'] = 'DevSync';
      // Prepend openrouter: prefix
      if (!model.startsWith('openrouter:')) {
        model = `openrouter:${model}`;
      }
    } else if (aiProvider === 'deepseek') {
      model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      model = 'gpt-4o-mini';
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Call AI API
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert database schema analyzer. Analyze code files and infer the expected database schema. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!aiResponse.ok) {
      let errorMessage = `AI API error (${aiResponse.status}): ${aiResponse.statusText}`;
      try {
        const errorData: any = await aiResponse.json();
        if (errorData?.error?.message) {
          errorMessage = `AI API error: ${errorData.error.message}`;
        } else if (errorData?.message) {
          errorMessage = `AI API error: ${errorData.message}`;
        }
      } catch {
        // If JSON parsing fails, use the status text
      }
      console.error(`[AI Analyze] ${aiProvider} API error:`, errorMessage);
      throw new Error(errorMessage);
    }

    const aiData: any = await aiResponse.json();
    const aiResponseText = aiData.choices[0]?.message?.content || '';

    // Parse AI response
    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Convert to schema format
    const models = parsed.models?.map((m: any) => ({
      name: m.name,
      fields: m.fields?.map((f: any) => ({
        name: f.name,
        type: mapTypeToPostgres(f.type),
        nullable: f.nullable ?? true,
        primaryKey: f.primaryKey ?? false
      })) || []
    })) || [];

    return NextResponse.json({
      schema: {
        models,
        type: 'raw-sql'
      }
    });
  } catch (error) {
    console.error('AI Analyze Codebase API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function mapTypeToPostgres(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'text': 'text',
    'varchar': 'text',
    'char': 'text',
    'number': 'integer',
    'integer': 'integer',
    'int': 'integer',
    'bigint': 'bigint',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'timestamp',
    'datetime': 'timestamp',
    'timestamp': 'timestamp',
    'uuid': 'uuid',
    'json': 'jsonb',
    'jsonb': 'jsonb'
  };

  return typeMap[type.toLowerCase()] || 'text';
}
