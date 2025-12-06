import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collaboration/metrics
 * Get team metrics
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
    const period = searchParams.get('period') || 'month';

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      );
    }

    // Verify team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Calculate period dates
    const now = new Date();
    const periodStart = new Date();
    
    switch (period) {
      case 'day':
        periodStart.setDate(now.getDate() - 1);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
    }

    // Get team projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('team_id', teamId);

    const projectIds = projects?.map((p: any) => p.id) || [];

    if (projectIds.length === 0) {
      return NextResponse.json({
        teamId,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        totalScans: 0,
        totalMigrations: 0,
        totalComments: 0,
        totalApprovals: 0,
        activeMembers: 0,
        activeProjects: 0,
        scansByStatus: {},
        migrationsByStatus: {},
        activityByType: {},
        mostActiveMembers: [],
        recentActivity: [],
      });
    }

    // Get scans
    const { data: scans } = await supabase
      .from('scan_reports')
      .select('status')
      .in('project_id', projectIds)
      .gte('created_at', periodStart.toISOString());

    const totalScans = scans?.length || 0;
    const scansByStatus = (scans || []).reduce((acc: Record<string, number>, scan: any) => {
      acc[scan.status] = (acc[scan.status] || 0) + 1;
      return acc;
    }, {});

    // Get migrations
    const { data: migrations } = await supabase
      .from('migrations')
      .select('applied, execution_status')
      .in('scan_report_id', scans?.map((s: any) => s.id) || []);

    const totalMigrations = migrations?.length || 0;
    const migrationsByStatus: Record<string, number> = {};
    (migrations || []).forEach((m: any) => {
      const status = m.applied ? 'applied' : (m.execution_status || 'pending');
      migrationsByStatus[status] = (migrationsByStatus[status] || 0) + 1;
    });

    // Get comments
    const { data: comments } = await supabase
      .from('mismatch_comments')
      .select('id')
      .in('scan_report_id', scans?.map((s: any) => s.id) || []);

    const totalComments = comments?.length || 0;

    // Get approvals
    const { data: approvals } = await supabase
      .from('approval_workflows')
      .select('id')
      .in('migration_id', migrations?.map((m: any) => m.id) || []);

    const totalApprovals = approvals?.length || 0;

    // Get active members (members with activity in period)
    const { data: activities } = await supabase
      .from('activity_feed')
      .select('actor_id')
      .eq('team_id', teamId)
      .gte('created_at', periodStart.toISOString());

    const memberActivityCounts = (activities || []).reduce((acc: Record<string, number>, activity: any) => {
      acc[activity.actor_id] = (acc[activity.actor_id] || 0) + 1;
      return acc;
    }, {});

    const activeMembers = Object.keys(memberActivityCounts).length;

    // Get most active members
    const mostActiveMembers = Object.entries(memberActivityCounts)
      .map(([userId, count]) => ({ userId, activityCount: count as number }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 10);

    // Get user info for most active members
    const userIds = mostActiveMembers.map(m => m.userId);
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);

      mostActiveMembers.forEach(member => {
        const user = users?.find((u: any) => u.id === member.userId);
        if (user) {
          (member as any).userName = user.email;
        }
      });
    }

    // Get activity by type
    const activityByType = (activities || []).reduce((acc: Record<string, number>, activity: any) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {});

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('activity_feed')
      .select(`
        *,
        actor:actor_id (
          id,
          email
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get active projects (projects with activity in period)
    const activeProjects = new Set(
      (activities || []).map((a: any) => a.project_id).filter(Boolean)
    ).size;

    return NextResponse.json({
      teamId,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      totalScans,
      totalMigrations,
      totalComments,
      totalApprovals,
      activeMembers,
      activeProjects,
      scansByStatus,
      migrationsByStatus,
      activityByType,
      mostActiveMembers,
      recentActivity: recentActivity || [],
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

