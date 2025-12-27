import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDriftTrends, getFrequentlyChangingObjects, detectAcceleratingDrift } from '@/lib/analytics/drift-analyzer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify access
    const { data: project } = await supabase
      .from('projects')
      .select('user_id, team_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const hasAccess = project.user_id === user.id ||
      (project.team_id && await checkTeamAccess(supabase, project.team_id, user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get drift trends
    const trends = await getDriftTrends(supabase, projectId, days);
    const frequentlyChanging = await getFrequentlyChangingObjects(supabase, projectId, 20);
    const acceleration = detectAcceleratingDrift(trends);

    return NextResponse.json({
      trends,
      frequentlyChanging,
      acceleration,
    });
  } catch (error) {
    console.error('Get drift analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function checkTeamAccess(supabase: any, teamId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

