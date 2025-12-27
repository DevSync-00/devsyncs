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
      // API key authentication (for CLI)
      const token = authHeader.replace('Bearer ', '');
      
      // Verify JWT token with Supabase
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
      
      if (!tokenError && tokenUser) {
        user = tokenUser;
      }
    } else {
      // Session authentication (for web)
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
    const { projectId, codeSchema, dbSchema, mismatches } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
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

    // Create scan report
    const { data: scanReport, error: insertError } = await supabase
      .from('scan_reports')
      .insert({
        project_id: projectId,
        status: 'completed',
        mismatches: mismatches || [],
        code_schema: codeSchema || null,
        db_schema: dbSchema || null,
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
      if (dbSchema) {
        await storeSchemaSnapshot(supabase, projectId, 'db', dbSchema, mismatches?.length || 0, user.id);
      }
      if (codeSchema) {
        await storeSchemaSnapshot(supabase, projectId, 'code', codeSchema, mismatches?.length || 0, user.id);
      }
      
      // Calculate drift metrics if we have both schemas
      if (dbSchema && codeSchema) {
        await calculateAndStoreDriftMetrics(supabase, projectId, dbSchema, codeSchema);
      }
      
      // Record team activity
      if (project.team_id) {
        await recordTeamActivity(supabase, {
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
    
    // Check authentication (supports both session and API key)
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader?.startsWith('Bearer ')) {
      // API key authentication (for CLI)
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
      
      if (!tokenError && tokenUser) {
        user = tokenUser;
      }
    } else {
      // Session authentication (for web)
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

