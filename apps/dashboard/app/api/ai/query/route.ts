import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
      
      if (!tokenError && tokenUser) {
        user = tokenUser;
      }
    } else {
      const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser();
      
      if (!authError && sessionUser) {
        user = sessionUser;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { question, scanReportId } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }

    if (!scanReportId) {
      return NextResponse.json(
        { error: 'scanReportId is required' },
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
      if (!apiKey) {
        return NextResponse.json(
          { error: 'DeepSeek API key not configured' },
          { status: 500 }
        );
      }
    } else {
      // OpenAI (explicit selection only)
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
      if (!apiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 500 }
        );
      }
    }

    // Fetch scan report
    const { data: scanReport } = await supabase
      .from('scan_reports')
      .select('*, projects(user_id)')
      .eq('id', scanReportId)
      .single();

    if (!scanReport || (scanReport.projects as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Scan report not found' },
        { status: 404 }
      );
    }

    // Generate AI answer using standalone reasoner
    const { AIReasoner } = await import('../../../../../../packages/ai-reasoner/src/reasoner-standalone');
    const reasoner = new AIReasoner(apiKey || '', baseUrl, aiProvider as 'puter' | 'openai' | 'deepseek');

    const answer = await reasoner.query(
      question,
      scanReport.mismatches || [],
      scanReport.code_schema,
      scanReport.db_schema
    );

    return NextResponse.json({
      answer,
      question,
      scanReportId,
    });
  } catch (error) {
    console.error('AI Query API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

