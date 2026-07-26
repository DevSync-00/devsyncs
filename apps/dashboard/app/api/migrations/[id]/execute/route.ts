import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

interface MigrationExecuteRequest {
  dryRun?: boolean;
  confirm?: boolean;
  confirmationText?: string;
  allowDestructive?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: MigrationExecuteRequest = await request.json().catch(() => ({}));
    const {
      dryRun = false,
      confirm = false,
      confirmationText = '',
      allowDestructive = false,
    } = body;

    // Require explicit confirmation for production runs
    if (!dryRun && !confirm) {
      return NextResponse.json(
        { error: 'Confirmation required. Set confirm: true to execute migration.' },
        { status: 400 }
      );
    }

    // Fetch migration
    const { data: migration, error: migrationError } = await supabase
      .from('migrations')
      .select(`
        *,
        scan_reports!inner(
          id,
          project_id,
          projects!inner(
            id,
            user_id,
            db_connection_string
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (migrationError || !migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    const project = (migration.scan_reports as any)?.projects;
    
    // Check access (owner or team member)
    const isOwner = project?.user_id === user.id;
    let hasTeamAccess = false;

    if (project?.team_id && !isOwner) {
      // Use RPC function to avoid RLS recursion issues
      const { data: isMember } = await supabase
        .rpc('check_team_membership', { team_uuid: project.team_id });
      
      hasTeamAccess = !!isMember;
    }

    if (!isOwner && !hasTeamAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if migration is already applied
    if (migration.applied && !dryRun) {
      return NextResponse.json(
        { error: 'Migration has already been applied' },
        { status: 400 }
      );
    }

    // Check if migration is currently running
    if (migration.execution_status === 'running') {
      return NextResponse.json(
        { error: 'Migration is currently being executed' },
        { status: 400 }
      );
    }

    const dbConnectionString = project.db_connection_string;
    if (!dbConnectionString) {
      return NextResponse.json(
        { error: 'Database connection string not configured for this project' },
        { status: 400 }
      );
    }

    if (typeof migration.content !== 'string' || !migration.content.trim()) {
      return NextResponse.json(
        { error: 'Migration SQL content is missing' },
        { status: 400 }
      );
    }

    const safety = analyzeMigrationSafety(migration.content);
    if (!dryRun && safety.destructive && !allowDestructive) {
      return NextResponse.json(
        {
          error: 'Destructive migration blocked',
          message: 'Set allowDestructive: true and provide the required confirmationText to execute destructive SQL.',
          requiredConfirmationText: `EXECUTE ${params.id}`,
          findings: safety.findings,
        },
        { status: 400 }
      );
    }

    if (!dryRun && safety.destructive && confirmationText !== `EXECUTE ${params.id}`) {
      return NextResponse.json(
        {
          error: 'Destructive migration confirmation required',
          requiredConfirmationText: `EXECUTE ${params.id}`,
          findings: safety.findings,
        },
        { status: 400 }
      );
    }

    // Update migration status to running
    const { error: updateError } = await supabase
      .from('migrations')
      .update({
        execution_status: 'running',
        execution_started_at: new Date().toISOString(),
        dry_run: dryRun,
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error updating migration status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update migration status' },
        { status: 500 }
      );
    }

    // Create migration history entry
    const { data: historyEntry, error: historyError } = await supabase
      .from('migration_history')
      .insert({
        migration_id: params.id,
        executed_by: user.id,
        execution_type: dryRun ? 'dry-run' : 'apply',
        status: 'running',
        sql_executed: migration.content,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error creating migration history:', historyError);
      // Continue execution even if history creation fails
    }

    let executionResult: {
      success: boolean;
      error?: string;
      affectedTables?: number;
      affectedRows?: number;
      executionTime?: number;
    };

    try {
      // Execute migration
      if (dryRun) {
        // For dry run, validate SQL without executing
        executionResult = await validateMigrationSQL(migration.content, dbConnectionString);
      } else {
        // For actual execution, run the SQL
        executionResult = await executeMigrationSQL(migration.content, dbConnectionString);
      }

      const executionTime = executionResult.executionTime || 0;

      // Update migration status
      if (executionResult.success) {
        await supabase
          .from('migrations')
          .update({
            execution_status: 'success',
            applied: !dryRun,
            applied_at: !dryRun ? new Date().toISOString() : null,
            applied_by: !dryRun ? user.id : null,
            execution_completed_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        // Update history entry
        if (historyEntry) {
          await supabase
            .from('migration_history')
            .update({
              status: 'success',
              completed_at: new Date().toISOString(),
              execution_time_ms: executionTime,
              affected_rows: executionResult.affectedRows || 0,
            })
            .eq('id', historyEntry.id);
        }

        // Record migration metrics (async, don't block response)
        try {
          const { storeMigrationMetric, calculateComplexityScore } = await import('@/lib/analytics/migration-metrics');
          const { recordTeamActivity } = await import('@/lib/analytics/team-metrics');
          
          const complexityScore = calculateComplexityScore(migration.content);
          const validationErrors = (migration.metadata as any)?.validation?.errors?.length || 0;
          const validationWarnings = (migration.metadata as any)?.validation?.warnings?.length || 0;
          const breakingChanges = (migration.metadata as any)?.validation?.breakingChanges?.length || 0;
          
          await storeMigrationMetric(supabase, {
            migration_id: params.id,
            project_id: project.id,
            execution_type: dryRun ? 'dry_run' : 'apply',
            execution_status: 'success',
            duration_ms: executionTime,
            affected_tables: executionResult.affectedTables || 0,
            affected_rows: executionResult.affectedRows || 0,
            complexity_score: complexityScore,
            validation_errors: validationErrors,
            validation_warnings: validationWarnings,
            breaking_changes: breakingChanges,
            executed_by: user.id,
            metadata: {
              dryRun,
              executionResult,
            },
          });
          
          // Record team activity
          if (project.team_id) {
            await recordTeamActivity(supabase, {
              team_id: project.team_id,
              user_id: user.id,
              project_id: project.id,
              activity_type: 'migration',
            });
          }
        } catch (analyticsError) {
          // Log but don't fail the request
          console.warn('Error recording migration analytics:', analyticsError);
        }

        return NextResponse.json({
          success: true,
          dryRun,
          message: dryRun ? 'Migration validation successful' : 'Migration applied successfully',
          executionTime,
          affectedRows: executionResult.affectedRows || 0,
        });
      } else {
        // Execution failed - enhanced error logging
        const errorMessage = executionResult.error || 'Unknown error';
        
        console.error('Migration execution failed:', {
          migrationId: params.id,
          error: errorMessage,
          executionTime,
          dryRun,
        });
        
        await supabase
          .from('migrations')
          .update({
            execution_status: 'failed',
            execution_error: errorMessage,
            execution_completed_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        // Record failed migration metrics
        try {
          const { storeMigrationMetric, calculateComplexityScore } = await import('@/lib/analytics/migration-metrics');
          
          const complexityScore = calculateComplexityScore(migration.content);
          
          await storeMigrationMetric(supabase, {
            migration_id: params.id,
            project_id: project.id,
            execution_type: dryRun ? 'dry_run' : 'apply',
            execution_status: 'failed',
            duration_ms: executionTime,
            complexity_score: complexityScore,
            executed_by: user.id,
            error_message: errorMessage,
            metadata: {
              dryRun,
              error: errorMessage,
            },
          });
        } catch (analyticsError) {
          console.warn('Error recording failed migration analytics:', analyticsError);
        }

        // Update history entry
        if (historyEntry) {
          await supabase
            .from('migration_history')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
              execution_time_ms: executionTime,
            })
            .eq('id', historyEntry.id);
        }

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
            executionTime,
            // Provide user-friendly error message
            message: dryRun 
              ? `Validation failed: ${errorMessage}`
              : `Migration execution failed: ${errorMessage}`,
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      
      // Enhanced error logging
      console.error('Migration execution error:', {
        migrationId: params.id,
        error: errorMessage,
        stack: error?.stack,
        dryRun,
      });
      
      // Update migration status
      try {
        await supabase
          .from('migrations')
          .update({
            execution_status: 'failed',
            execution_error: errorMessage,
            execution_completed_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        // Update history entry
        if (historyEntry) {
          await supabase
            .from('migration_history')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyEntry.id);
        }
      } catch (updateError) {
        console.error('Failed to update migration status after error:', updateError);
      }

      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          message: `Migration execution error: ${errorMessage}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Enhanced error logging
    const errorDetails = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      timestamp: new Date().toISOString(),
      migrationId: params.id,
    };
    
    console.error('Migration execution error:', errorDetails);
    
    // Update migration status to failed if it exists
    try {
      const supabase = await createClient();
      await supabase
        .from('migrations')
        .update({
          execution_status: 'failed',
          execution_error: errorDetails.message,
          execution_completed_at: new Date().toISOString(),
        })
        .eq('id', params.id);
    } catch (updateError) {
      console.error('Failed to update migration status:', updateError);
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorDetails.message,
        // Only include details in development
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails }),
      },
      { status: 500 }
    );
  }
}

async function validateMigrationSQL(sql: string, connectionString: string): Promise<{
  success: boolean;
  error?: string;
  executionTime?: number;
  validation?: any; // Full validation result
}> {
  const startTime = Date.now();
  
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout = '30s'`);
    await client.query(`SET lock_timeout = '5s'`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('ROLLBACK');

    return {
      success: true,
      executionTime: Date.now() - startTime,
      validation: { mode: 'transaction-rollback' },
    };
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback cleanup errors.
    }

    return {
      success: false,
      error: error.message || 'Failed to validate SQL',
      executionTime: Date.now() - startTime,
    };
  } finally {
    client.release();
    await pool.end();
  }
}

async function executeMigrationSQL(sql: string, connectionString: string): Promise<{
  success: boolean;
  error?: string;
  affectedTables?: number;
  affectedRows?: number;
  executionTime?: number;
}> {
  const startTime = Date.now();
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query(`SET statement_timeout = '30s'`);
      await client.query(`SET lock_timeout = '5s'`);
      await client.query(`SELECT pg_advisory_lock(hashtext('devsync:migration'))`);

      const result = await client.query(sql);
      
      // Calculate affected rows (simplified - counts all rows from all statements)
      const affectedRows = result.rowCount || 0;

      return {
        success: true,
        affectedTables: estimateAffectedTables(sql),
        affectedRows,
        executionTime: Date.now() - startTime,
      };
    } finally {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext('devsync:migration'))`);
      } catch {
        // Ignore unlock errors; the connection close releases advisory locks too.
      }
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute SQL',
      executionTime: Date.now() - startTime,
    };
  } finally {
    await pool.end();
  }
}

function estimateAffectedTables(sql: string): number {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
  const tablePattern = /\b(?:ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["']?([a-zA-Z_][a-zA-Z0-9_.]*)["']?/gi;
  const tables = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = tablePattern.exec(stripped)) !== null) {
    tables.add(match[1].toLowerCase());
  }
  return tables.size;
}

function analyzeMigrationSafety(sql: string): {
  destructive: boolean;
  findings: string[];
} {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .toUpperCase();

  const destructivePatterns = [
    /\bDROP\s+TABLE\b/,
    /\bDROP\s+COLUMN\b/,
    /\bTRUNCATE\b/,
    /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/,
    /\bALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\bTYPE\b/,
    /\bALTER\s+TABLE\b[\s\S]*\bSET\s+NOT\s+NULL\b/,
  ];

  const findings = destructivePatterns
    .filter((pattern) => pattern.test(stripped))
    .map((pattern) => pattern.source);

  return {
    destructive: findings.length > 0,
    findings,
  };
}
