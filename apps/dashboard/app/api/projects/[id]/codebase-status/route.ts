import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET: Check codebase processing status for a project
export async function GET(
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

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, config, user_id, team_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check access (owner or team member)
    const isOwner = project.user_id === user.id;
    let hasTeamAccess = false;

    if (project.team_id) {
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

    // Extract codebase status from config
    const codebase = (project.config as any)?.codebase || null;
    
    if (!codebase) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'No codebase source configured',
      });
    }

    return NextResponse.json({
      status: codebase.status || 'unknown',
      type: codebase.type,
      url: codebase.url,
      uploadedFiles: codebase.uploadedFiles || [],
      fileCount: codebase.fileCount || 0,
      error: codebase.error || null,
      jobId: codebase.jobId || null,
      clonedAt: codebase.clonedAt || null,
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

