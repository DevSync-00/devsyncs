import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collaboration/activity
 * Get activity feed
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('activity_feed')
      .select(`
        *,
        actor:actor_id (
          id,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // If no team or project filter, show user's teams and projects
    if (!teamId && !projectId) {
      // Get user's teams
      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const teamIds = teamMemberships?.map((tm: any) => tm.team_id) || [];

      // Get user's projects
      const { data: userProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id);

      const projectIds = userProjects?.map((p: any) => p.id) || [];

      if (teamIds.length > 0 || projectIds.length > 0) {
        query = query.or(
          `team_id.in.(${teamIds.join(',')}),project_id.in.(${projectIds.join(',')})`
        );
      } else {
        // No teams or projects, return empty
        return NextResponse.json({ activities: [] });
      }
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error('Error fetching activity:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activity feed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

