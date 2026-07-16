import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/app/api/projects/utils';
import { Pool } from 'pg';

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
    const { scanReportId, format = 'sql' } = body;

    if (!scanReportId) {
      return NextResponse.json(
        { error: 'scanReportId is required' },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminClient() as any;

    // Fetch scan report
    const { data: scanReport, error: scanError } = await adminSupabase
      .from('scan_reports')
      .select('*, projects(id, name, user_id, db_connection_string)')
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

    // Validate migration if database connection available
    let validationResult = null;
    const dbConnectionString = project.db_connection_string;
    
    if (dbConnectionString && typeof dbConnectionString === 'string') {
      try {
        {
          // Basic validation using PostgreSQL EXPLAIN and destructive-operation detection.
          const pool = new Pool({ connectionString: dbConnectionString });
          const client = await pool.connect();
          
          try {
            const statements = migrationSQL.split(';').filter(s => s.trim().length > 0);
            const errors: any[] = [];
            const warnings: any[] = [];
            
            for (const statement of statements) {
              const trimmed = statement.trim();
              if (trimmed.startsWith('--') || 
                  trimmed.toUpperCase().startsWith('BEGIN') || 
                  trimmed.toUpperCase().startsWith('COMMIT') ||
                  trimmed.length === 0) {
                continue;
              }
              
              // Check for breaking changes (basic detection)
              const upperSQL = trimmed.toUpperCase();
              if (upperSQL.includes('DROP TABLE') || upperSQL.includes('DROP COLUMN') || upperSQL.includes('TRUNCATE')) {
                warnings.push({
                  type: 'data_loss',
                  severity: 'warning',
                  message: `Potentially destructive operation detected: ${trimmed.substring(0, 50)}...`,
                  suggestion: 'Review carefully - this may cause data loss'
                });
              }

              if (
                upperSQL.startsWith('ALTER TABLE') ||
                upperSQL.startsWith('CREATE TABLE') ||
                upperSQL.startsWith('DROP TABLE') ||
                upperSQL.startsWith('CREATE INDEX') ||
                upperSQL.startsWith('DROP INDEX')
              ) {
                warnings.push({
                  type: 'ddl_validation_skipped',
                  severity: 'info',
                  message: `DDL validation is deferred to dry run: ${trimmed.substring(0, 50)}...`,
                  suggestion: 'Use dry run before applying this migration.'
                });
                continue;
              }
              
              // Validate syntax
              try {
                await client.query(`EXPLAIN ${trimmed}`);
              } catch (explainError: any) {
                errors.push({
                  type: 'syntax',
                  severity: 'error',
                  message: `SQL syntax error: ${explainError.message}`,
                  suggestion: 'Check SQL syntax against PostgreSQL documentation'
                });
              }
            }
            
            validationResult = {
              valid: errors.length === 0,
              errors,
              warnings,
              breakingChanges: warnings.filter(w => w.type === 'data_loss').map(w => ({
                type: 'drop_table' as const,
                severity: 'warning' as const,
                message: w.message,
                impact: 'This operation may cause data loss',
                mitigation: w.suggestion
              })),
              summary: {
                totalIssues: errors.length + warnings.length,
                errorCount: errors.length,
                warningCount: warnings.length,
                breakingChangeCount: warnings.filter(w => w.type === 'data_loss').length
              }
            };
          } finally {
            client.release();
            await pool.end();
          }
        }
      } catch (validationError) {
        // Log but don't fail - validation errors will be shown to user
        console.warn('Migration validation failed:', validationError);
        validationResult = {
          valid: false,
          errors: [{
            type: 'semantic' as const,
            severity: 'error' as const,
            message: `Validation error: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`
          }],
          warnings: [],
          breakingChanges: [],
          summary: {
            totalIssues: 1,
            errorCount: 1,
            warningCount: 0,
            breakingChangeCount: 0
          }
        };
      }
    }

    // Create migration record
    const { data: migration, error: insertError } = await adminSupabase
      .from('migrations')
      .insert({
        scan_report_id: scanReportId,
        filename: migrationName,
        content: migrationSQL,
        format: format,
        applied: false,
        // Store validation results in metadata (if supported by schema)
        metadata: validationResult ? {
          validation: {
            valid: validationResult.valid,
            errorCount: validationResult.summary.errorCount,
            warningCount: validationResult.summary.warningCount,
            breakingChangeCount: validationResult.summary.breakingChangeCount
          }
        } : null
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
      id: migration.id,
      migrationId: migration.id,
      filename: migration.filename,
      sql: migration.content,
      content: migration.content,
      format: migration.format,
      createdAt: migration.created_at,
      validation: validationResult ? {
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        breakingChanges: validationResult.breakingChanges,
        summary: validationResult.summary
      } : null
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
    
    const user = await resolveUser(request, supabase);

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

    const adminSupabase = getAdminClient() as any;

    let query = adminSupabase
      .from('migrations')
      .select('*, scan_reports(project_id, projects(id, name, user_id))');

    if (projectId) {
      // Get migrations for all scan reports in this project
      const { data: scanReports } = await adminSupabase
        .from('scan_reports')
        .select('id')
        .eq('project_id', projectId);

      const scanReportIds = scanReports?.map((sr: any) => sr.id) || [];
      
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

