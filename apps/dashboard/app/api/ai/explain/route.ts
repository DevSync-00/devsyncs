import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/app/api/projects/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const user = await resolveUser(request, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { scanReportId, migrationId } = body;

    if (!scanReportId && !migrationId) {
      return NextResponse.json(
        { error: 'scanReportId or migrationId is required' },
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

    // Fetch scan report or migration
    let mismatches: any[] = [];
    let codeSchema: any = null;
    let dbSchema: any = null;

    if (scanReportId) {
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

      mismatches = scanReport.mismatches || [];
      codeSchema = scanReport.code_schema;
      dbSchema = scanReport.db_schema;
    } else if (migrationId) {
      const { data: migration } = await supabase
        .from('migrations')
        .select('*, scan_reports(mismatches, code_schema, db_schema, projects(user_id))')
        .eq('id', migrationId)
        .single();

      if (!migration || (migration.scan_reports?.projects as any)?.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Migration not found' },
          { status: 404 }
        );
      }

      mismatches = migration.scan_reports?.mismatches || [];
      codeSchema = migration.scan_reports?.code_schema;
      dbSchema = migration.scan_reports?.db_schema;
    }

    // Generate AI explanation using standalone reasoner
    const { AIReasoner } = await import('../../../../../../packages/ai-reasoner/src/reasoner-standalone');
    const reasoner = new AIReasoner(apiKey || '', baseUrl, aiProvider as 'puter' | 'openai' | 'deepseek');

    const explanation = await reasoner.explainMigration(mismatches, codeSchema, dbSchema);
    const riskAssessment = await reasoner.assessRisk(mismatches, codeSchema, dbSchema);

    return NextResponse.json({
      explanation,
      riskAssessment,
    });
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

