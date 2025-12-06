import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reporting/templates
 * Get report templates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Get built-in templates
    const builtInTemplates = [
      {
        id: 'scan-summary',
        name: 'Scan Summary',
        description: 'Summary of all scans with status and mismatch counts',
        type: 'scan_summary',
        defaultConfig: {
          type: 'scan_summary',
          format: 'html',
          period: 'month',
          includeMetrics: true,
          includeTrends: false,
          includeCharts: true,
        },
        builtIn: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'migration-summary',
        name: 'Migration Summary',
        description: 'Summary of all migrations with execution status',
        type: 'migration_summary',
        defaultConfig: {
          type: 'migration_summary',
          format: 'html',
          period: 'month',
          includeMetrics: true,
          includeTrends: false,
          includeCharts: true,
        },
        builtIn: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'team-activity',
        name: 'Team Activity',
        description: 'Team activity report with member contributions',
        type: 'team_activity',
        defaultConfig: {
          type: 'team_activity',
          format: 'html',
          period: 'month',
          includeMetrics: true,
          includeTrends: true,
          includeCharts: true,
        },
        builtIn: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'project-health',
        name: 'Project Health',
        description: 'Overall project health with mismatch trends',
        type: 'project_health',
        defaultConfig: {
          type: 'project_health',
          format: 'html',
          period: 'month',
          includeMetrics: true,
          includeTrends: true,
          includeCharts: true,
        },
        builtIn: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mismatch-analysis',
        name: 'Mismatch Analysis',
        description: 'Detailed analysis of mismatches by type and severity',
        type: 'mismatch_analysis',
        defaultConfig: {
          type: 'mismatch_analysis',
          format: 'html',
          period: 'month',
          includeMetrics: true,
          includeTrends: true,
          includeCharts: true,
        },
        builtIn: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Get user's custom templates
    const { data: customTemplates } = await supabase
      .from('report_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    let templates = [
      ...builtInTemplates,
      ...(customTemplates || []).map((t: any) => ({
        ...t,
        builtIn: false,
      })),
    ];

    // Filter by type if provided
    if (type) {
      templates = templates.filter((t) => t.type === type);
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reporting/templates
 * Create a custom report template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, type, defaultConfig } = body;

    if (!name || !type || !defaultConfig) {
      return NextResponse.json(
        { error: 'name, type, and defaultConfig are required' },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from('report_templates')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        type,
        default_config: defaultConfig,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

