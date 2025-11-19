import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

interface MigrationRollbackRequest {
  confirm?: boolean;
}

/**
 * Extract rollback SQL from migration content
 * Rollback script starts with "-- Rollback script" comment
 */
function extractRollbackSQL(content: string): string | null {
  const rollbackMarker = '-- Rollback script';
  const rollbackIndex = content.indexOf(rollbackMarker);
  
  if (rollbackIndex === -1) {
    return null;
  }
  
  // Extract everything after the rollback marker
  return content.substring(rollbackIndex).replace(rollbackMarker, '').trim();
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

    const body: MigrationRollbackRequest = await request.json().catch(() => ({}));
    const { confirm = false } = body;

    // Require explicit confirmation
    if (!confirm) {
      return NextResponse.json(
        { error: 'Confirmation required. Set confirm: true to rollback migration.' },
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
            team_id,
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

    // Check if migration has been applied
    if (!migration.applied && migration.execution_status !== 'success') {
      return NextResponse.json(
        { error: 'Migration has not been applied yet. Only applied migrations can be rolled back.' },
        { status: 400 }
      );
    }

    // Extract rollback SQL
    const rollbackSQL = extractRollbackSQL(migration.content);
    
    if (!rollbackSQL) {
      return NextResponse.json(
        { error: 'No rollback script found for this migration' },
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
        execution_type: 'rollback',
        status: 'running',
        sql_executed: rollbackSQL,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error creating migration history:', historyError);
      // Continue execution even if history creation fails
    }

    const startTime = Date.now();
    let executionResult: {
      success: boolean;
      error?: string;
      affectedRows?: number;
      executionTime?: number;
    };

    try {
      // Execute rollback
      const pool = new Pool({
        connectionString: dbConnectionString,
      });

      try {
        // Validate SQL syntax first
        await pool.query('BEGIN');
        
        // Split SQL by semicolons and execute
        const statements = rollbackSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        let affectedRows = 0;
        
        for (const statement of statements) {
          if (statement.toUpperCase().startsWith('BEGIN') || 
              statement.toUpperCase().startsWith('COMMIT')) {
            continue;
          }
          
          const result = await pool.query(statement);
          affectedRows += result.rowCount || 0;
        }
        
        await pool.query('COMMIT');

        const executionTime = Date.now() - startTime;

        executionResult = {
          success: true,
          affectedRows,
          executionTime,
        };

        // Update migration status to success and mark as not applied
        await supabase
          .from('migrations')
          .update({
            execution_status: 'success',
            applied: false,
            applied_at: null,
            execution_completed_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        // Update history entry
        if (historyEntry) {
          await supabase
            .from('migration_history')
            .update({
              status: 'success',
              execution_time_ms: executionTime,
              affected_rows: affectedRows,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyEntry.id);
        }
      } catch (dbError: any) {
        await pool.query('ROLLBACK');
        
        const executionTime = Date.now() - startTime;
        const errorMessage = dbError.message || 'Unknown database error';

        executionResult = {
          success: false,
          error: errorMessage,
          executionTime,
        };

        // Update migration status to failed
        await supabase
          .from('migrations')
          .update({
            execution_status: 'failed',
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
              execution_time_ms: executionTime,
              completed_at: new Date().toISOString(),
            })
            .eq('id', historyEntry.id);
        }
      } finally {
        await pool.end();
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error occurred';

      executionResult = {
        success: false,
        error: errorMessage,
        executionTime,
      };

      // Update migration status to failed
      await supabase
        .from('migrations')
        .update({
          execution_status: 'failed',
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
            execution_time_ms: executionTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', historyEntry.id);
      }
    }

    if (!executionResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: executionResult.error,
          message: `Rollback failed: ${executionResult.error}`,
          executionTime: executionResult.executionTime,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migration rolled back successfully',
      executionTime: executionResult.executionTime,
      affectedRows: executionResult.affectedRows,
    });
  } catch (error: any) {
    console.error('Rollback migration error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        message: error.message || 'Failed to rollback migration',
      },
      { status: 500 }
    );
  }
}

