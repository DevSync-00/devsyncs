import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/app/api/projects/utils';
import {
  compareSchemas,
  scanDatabaseSchema,
  scanCodebaseSchema,
} from '@/lib/schema-scanner';
import { ensureGitClone } from '@/lib/codebase-storage';

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
    const { projectId, codeSchema, dbSchema, mismatches } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminClient() as any;

    // Verify project exists and user has access
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user has access (owner or team member)
    const isOwner = project.user_id === user.id;
    let hasTeamAccess = false;

    if (project.team_id && !isOwner) {
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

    let finalCodeSchema = codeSchema || null;
    let finalDbSchema = dbSchema || null;
    let finalMismatches = mismatches || null;
    const scanMetadata: Record<string, any> = {
      mode: codeSchema || dbSchema || mismatches ? 'manual' : 'real',
    };

    if (!finalCodeSchema || !finalDbSchema || !finalMismatches) {
      const codebase = (project.config as any)?.codebase || {};
      let clonePath = codebase.clonePath;

      if (!clonePath) {
        if (codebase.type !== 'git' || !codebase.url) {
          return NextResponse.json(
            {
              error: 'Repository clone is not available',
              details: 'Wait for the Git clone to finish, then run the scan again.',
            },
            { status: 400 }
          );
        }
      }

      if (!project.db_connection_string) {
        return NextResponse.json(
          {
            error: 'Database connection string is not configured',
            details: 'Add a project database connection string before running a real scan.',
          },
          { status: 400 }
        );
      }

      try {
        if (codebase.type === 'git' && codebase.url) {
          clonePath = await ensureGitClone(projectId, codebase.url, clonePath);

          if (clonePath !== codebase.clonePath) {
            await adminSupabase
              .from('projects')
              .update({
                config: {
                  ...project.config,
                  codebase: {
                    ...codebase,
                    status: 'completed',
                    clonedAt: new Date().toISOString(),
                    clonePath,
                  },
                },
              })
              .eq('id', projectId);
          }
        }

        finalCodeSchema = scanCodebaseSchema(clonePath);
      } catch (scanError: any) {
        console.error('Codebase scan failed:', scanError);
        return NextResponse.json(
          {
            error: 'Failed to scan codebase',
            details: scanError?.message || 'Unknown codebase scan error',
          },
          { status: 500 }
        );
      }

      try {
        finalDbSchema = await scanDatabaseSchema(project.db_connection_string);
      } catch (scanError: any) {
        console.error('Database scan failed:', scanError);
        return NextResponse.json(
          {
            error: 'Failed to scan database',
            details: scanError?.message || 'Unknown database scan error',
          },
          { status: 500 }
        );
      }

      finalMismatches = compareSchemas(finalCodeSchema, finalDbSchema);

      scanMetadata.codebase = {
        type: codebase.type,
        url: codebase.url,
        clonePath,
      };
      scanMetadata.counts = {
        codeTables: finalCodeSchema.metadata.tableCount,
        codeColumns: finalCodeSchema.metadata.columnCount,
        dbTables: finalDbSchema.metadata.tableCount,
        dbColumns: finalDbSchema.metadata.columnCount,
        mismatches: finalMismatches.length,
      };
      scanMetadata.warnings = finalCodeSchema.metadata.warnings || [];
    }

    // Create scan report
    const { data: scanReport, error: insertError } = await adminSupabase
      .from('scan_reports')
      .insert({
        project_id: projectId,
        status: 'completed',
        mismatches: finalMismatches || [],
        code_schema: finalCodeSchema,
        db_schema: finalDbSchema,
        metadata: scanMetadata,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating scan report:', insertError);
      return NextResponse.json(
        { error: 'Failed to create scan report', details: insertError.message },
        { status: 500 }
      );
    }

    // Record analytics (async, don't block response)
    try {
      const { storeSchemaSnapshot, calculateAndStoreDriftMetrics } = await import('@/lib/analytics/drift-analyzer');
      const { recordTeamActivity } = await import('@/lib/analytics/team-metrics');
      
      // Store schema snapshots
      if (finalDbSchema) {
        await storeSchemaSnapshot(adminSupabase, projectId, 'db', finalDbSchema, finalMismatches?.length || 0, user.id);
      }
      if (finalCodeSchema) {
        await storeSchemaSnapshot(adminSupabase, projectId, 'code', finalCodeSchema, finalMismatches?.length || 0, user.id);
      }
      
      // Calculate drift metrics if we have both schemas
      if (finalDbSchema && finalCodeSchema) {
        await calculateAndStoreDriftMetrics(adminSupabase, projectId, finalDbSchema, finalCodeSchema);
      }
      
      // Record team activity
      if (project.team_id) {
        await recordTeamActivity(adminSupabase, {
          team_id: project.team_id,
          user_id: user.id,
          project_id: projectId,
          activity_type: 'scan',
        });
      }
    } catch (analyticsError) {
      // Log but don't fail the request
      console.warn('Error recording analytics:', analyticsError);
    }

    return NextResponse.json({
      scanId: scanReport.id,
      status: 'success',
      mismatches: scanReport.mismatches,
      createdAt: scanReport.created_at,
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown scan error',
      },
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

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Fetch scan reports
    const { data: scanReports, error } = await supabase
      .from('scan_reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch scan reports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scanReports });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

