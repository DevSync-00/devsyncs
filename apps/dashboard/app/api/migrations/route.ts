import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication (supports both session and API key)
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
    const { scanReportId, format = 'sql' } = body;

    if (!scanReportId) {
      return NextResponse.json(
        { error: 'scanReportId is required' },
        { status: 400 }
      );
    }

    // Fetch scan report
    const { data: scanReport, error: scanError } = await supabase
      .from('scan_reports')
      .select('*, projects(id, name, user_id)')
      .eq('id', scanReportId)
      .single();

    if (scanError || !scanReport) {
      return NextResponse.json(
        { error: 'Scan report not found' },
        { status: 404 }
      );
    }

    const project = scanReport.projects as any;

    // Check access
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Generate migration using the CLI's migration generator
    // Import the migration generator (will need to be adapted for browser)
    // For now, we'll generate SQL from mismatches directly

    const mismatches = (scanReport.mismatches as any[]) || [];
    const codeSchema = scanReport.code_schema;
    const dbSchema = scanReport.db_schema;

    // Generate migration SQL
    const migrationSQL = generateMigrationSQL(mismatches, codeSchema, dbSchema);
    const migrationName = generateMigrationName(mismatches);

    // Create migration record
    const { data: migration, error: insertError } = await supabase
      .from('migrations')
      .insert({
        scan_report_id: scanReportId,
        filename: migrationName,
        content: migrationSQL,
        format: format,
        applied: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating migration:', insertError);
      return NextResponse.json(
        { error: 'Failed to create migration', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      migrationId: migration.id,
      filename: migration.filename,
      sql: migration.content,
      format: migration.format,
      createdAt: migration.created_at,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const scanReportId = searchParams.get('scanReportId');

    if (!projectId && !scanReportId) {
      return NextResponse.json(
        { error: 'projectId or scanReportId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('migrations')
      .select('*, scan_reports(project_id, projects(id, name, user_id))');

    if (projectId) {
      // Get migrations for all scan reports in this project
      const { data: scanReports } = await supabase
        .from('scan_reports')
        .select('id')
        .eq('project_id', projectId);

      const scanReportIds = scanReports?.map(sr => sr.id) || [];
      
      if (scanReportIds.length === 0) {
        return NextResponse.json({ migrations: [] });
      }

      query = query.in('scan_report_id', scanReportIds);
    } else if (scanReportId) {
      query = query.eq('scan_report_id', scanReportId);
    }

    const { data: migrations, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch migrations' },
        { status: 500 }
      );
    }

    // Filter by user access
    const accessibleMigrations = migrations?.filter((m: any) => {
      const project = m.scan_reports?.projects;
      return project?.user_id === user.id;
    }) || [];

    return NextResponse.json({ migrations: accessibleMigrations });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Simplified migration SQL generation (server-side)
function generateMigrationSQL(mismatches: any[], codeSchema?: any, dbSchema?: any): string {
  const errors = mismatches.filter(m => m.severity === 'error');
  const warnings = mismatches.filter(m => m.severity === 'warning');
  const infos = mismatches.filter(m => m.severity === 'info');

  const statements: string[] = [];
  
  statements.push(`-- Migration: ${generateMigrationName(mismatches)}`);
  statements.push(`-- Generated: ${new Date().toISOString()}`);
  statements.push(`-- Mismatches: ${mismatches.length} (${errors.length} errors, ${warnings.length} warnings, ${infos.length} info)`);
  statements.push('');
  statements.push('BEGIN;');
  statements.push('');

  // Process errors first
  if (errors.length > 0) {
    statements.push('-- Critical changes (errors)');
    for (const mismatch of errors) {
      if (mismatch.suggestedFix) {
        statements.push(mismatch.suggestedFix);
      }
    }
    statements.push('');
  }

  // Process warnings
  if (warnings.length > 0) {
    statements.push('-- Warning changes');
    for (const mismatch of warnings) {
      if (mismatch.suggestedFix) {
        statements.push(mismatch.suggestedFix);
      }
    }
    statements.push('');
  }

  // Process info (commented out)
  if (infos.length > 0) {
    statements.push('-- Info changes (optional - uncomment to apply)');
    for (const mismatch of infos) {
      if (mismatch.suggestedFix) {
        statements.push(`-- ${mismatch.suggestedFix}`);
      }
    }
    statements.push('');
  }

  statements.push('COMMIT;');

  return statements.join('\n');
}

function generateMigrationName(mismatches: any[]): string {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '_');
  
  const types = new Set(mismatches.map(m => m.type));
  const typeNames: Record<string, string> = {
    'missing_table': 'add_tables',
    'missing_field': 'add_columns',
    'type_mismatch': 'alter_types',
    'constraint_mismatch': 'alter_constraints',
    'extra_field': 'remove_columns'
  };
  
  const typeStr = Array.from(types)
    .map(t => typeNames[t] || t)
    .join('_');
  
  return `${dateStr}_${typeStr}.sql`;
}

