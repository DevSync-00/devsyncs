import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

interface MigrationExecuteRequest {
  dryRun?: boolean;
  confirm?: boolean;
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
    const { dryRun = false, confirm = false } = body;

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
    
    // Check access
    if (!project || project.user_id !== user.id) {
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
}> {
  const startTime = Date.now();
  const pool = new Pool({ connectionString });
  
  try {
    // Try to parse and validate SQL without executing
    // Note: This is a simplified validation - in production, you'd want more robust validation
    const client = await pool.connect();
    
    try {
      // Parse SQL to check for syntax errors (PostgreSQL can do this with EXPLAIN)
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      
      for (const statement of statements) {
        const trimmed = statement.trim();
        
        // Skip comments and transaction commands
        if (
          trimmed.startsWith('--') ||
          trimmed.toUpperCase().startsWith('BEGIN') ||
          trimmed.toUpperCase().startsWith('COMMIT') ||
          trimmed.length === 0
        ) {
          continue;
        }

        // Try to explain the statement (validates syntax without executing)
        try {
          await client.query(`EXPLAIN ${trimmed}`);
        } catch (explainError: any) {
          // If EXPLAIN fails, the SQL is likely invalid
          return {
            success: false,
            error: `SQL validation failed: ${explainError.message}`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to validate SQL',
      executionTime: Date.now() - startTime,
    };
  } finally {
    await pool.end();
  }
}

async function executeMigrationSQL(sql: string, connectionString: string): Promise<{
  success: boolean;
  error?: string;
  affectedRows?: number;
  executionTime?: number;
}> {
  const startTime = Date.now();
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    try {
      // Execute the migration SQL
      const result = await client.query(sql);
      
      // Calculate affected rows (simplified - counts all rows from all statements)
      const affectedRows = result.rowCount || 0;

      return {
        success: true,
        affectedRows,
        executionTime: Date.now() - startTime,
      };
    } finally {
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

