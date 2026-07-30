import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '../../utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
      const supabase = await createClient();
      const user = await resolveUser(req, supabase);

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify project exists and user has access
      const accessResult = await verifyProjectAccess(supabase, params.id, user.id);
      if (accessResult.error) {
        return NextResponse.json({ error: accessResult.error.message }, { status: accessResult.error.status });
      }

      // Fetch layout
      const { data: layout, error: fetchError } = await supabase
        .from('project_layouts')
        .select('layout_data')
        .eq('project_id', params.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch layout error:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch layout' }, { status: 500 });
      }

      return NextResponse.json({
        layout: layout?.layout_data || { tablePositions: {} }
      });
    } catch (error) {
      console.error('API error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
      const supabase = await createClient();
      const user = await resolveUser(req, supabase);

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify project exists and user has access
      const accessResult = await verifyProjectAccess(supabase, params.id, user.id);
      if (accessResult.error) {
        return NextResponse.json({ error: accessResult.error.message }, { status: accessResult.error.status });
      }

      const body = await req.json();
      const { layout } = body;

      if (!layout || typeof layout !== 'object') {
        return NextResponse.json({ error: 'Invalid layout payload' }, { status: 400 });
      }

      // Upsert layout
      const { error: upsertError } = await supabase
        .from('project_layouts')
        .upsert(
          {
            project_id: params.id,
            layout_data: layout,
            updated_at: new Date().toISOString(),
            updated_by: user.id
          },
          { onConflict: 'project_id' }
        );

      if (upsertError) {
        console.error('Upsert layout error:', upsertError);
        return NextResponse.json({ error: 'Failed to save layout' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('API error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(request);
}

async function verifyProjectAccess(supabase: any, projectId: string, userId: string) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, user_id, team_id')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return {
      error: {
        status: 404,
        message: 'Project not found'
      }
    };
  }

  const isOwner = project.user_id === userId;
  let hasTeamAccess = false;

  if (project.team_id) {
    const { data: isMember } = await supabase
      .rpc('check_team_membership', { team_uuid: project.team_id });
    hasTeamAccess = !!isMember;
  }

  if (!isOwner && !hasTeamAccess) {
    return {
      error: {
        status: 403,
        message: 'Access denied'
      }
    };
  }

  return {};
}
