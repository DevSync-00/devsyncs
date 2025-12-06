import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, MessageSquare, CheckCircle, FileText, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default async function TeamCollaborationPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', params.id)
    .single();

  if (teamError || !team) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Link href={`/dashboard/teams/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </Link>
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">Team not found</p>
        </div>
      </div>
    );
  }

  // Check membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    redirect('/dashboard/teams');
  }

  // Fetch metrics directly from Supabase
  const now = new Date();
  const periodStart = new Date();
  periodStart.setMonth(now.getMonth() - 1);

  // Get team projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('team_id', params.id);

  const projectIds = projects?.map((p: any) => p.id) || [];

  // Get scans
  const { data: scans } = projectIds.length > 0 ? await supabase
    .from('scan_reports')
    .select('status')
    .in('project_id', projectIds)
    .gte('created_at', periodStart.toISOString()) : { data: null };

  const totalScans = scans?.length || 0;
  const scansByStatus = (scans || []).reduce((acc: Record<string, number>, scan: any) => {
    acc[scan.status] = (acc[scan.status] || 0) + 1;
    return acc;
  }, {});

  // Get migrations
  const scanReportIds = scans?.map((s: any) => s.id) || [];
  const { data: migrations } = scanReportIds.length > 0 ? await supabase
    .from('migrations')
    .select('applied, execution_status')
    .in('scan_report_id', scanReportIds) : { data: null };

  const totalMigrations = migrations?.length || 0;

  // Get comments
  const { data: comments } = scanReportIds.length > 0 ? await supabase
    .from('mismatch_comments')
    .select('id')
    .in('scan_report_id', scanReportIds) : { data: null };

  const totalComments = comments?.length || 0;

  // Get approvals
  const migrationIds = migrations?.map((m: any) => m.id) || [];
  const { data: approvals } = migrationIds.length > 0 ? await supabase
    .from('approval_workflows')
    .select('id')
    .in('migration_id', migrationIds) : { data: null };

  const totalApprovals = approvals?.length || 0;

  // Get activity with actor info (note: actor_id references auth.users, so we'll get email separately if needed)
  const { data: activities } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('team_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);
  
  // Note: In a real implementation, you'd join with auth.users or a users table
  // For now, we'll display actor_id and fetch user emails separately if needed

  // Get active members
  const { data: memberActivities } = await supabase
    .from('activity_feed')
    .select('actor_id')
    .eq('team_id', params.id)
    .gte('created_at', periodStart.toISOString());

  const memberActivityCounts = (memberActivities || []).reduce((acc: Record<string, number>, activity: any) => {
    acc[activity.actor_id] = (acc[activity.actor_id] || 0) + 1;
    return acc;
  }, {});

  const mostActiveMembers = Object.entries(memberActivityCounts)
    .map(([userId, count]) => ({ userId, activityCount: count as number }))
    .sort((a, b) => b.activityCount - a.activityCount)
    .slice(0, 10);

  const metrics = {
    totalScans,
    totalMigrations,
    totalComments,
    totalApprovals,
    activeMembers: Object.keys(memberActivityCounts).length,
    activeProjects: projectIds.length,
    scansByStatus,
    migrationsByStatus: {},
    activityByType: {},
    mostActiveMembers,
    recentActivity: activities || [],
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/teams/${params.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-4">Team Collaboration</h1>
          <p className="text-muted-foreground mt-2">
            Metrics and activity for {team.name}
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scans</p>
                <p className="text-2xl font-bold">{metrics.totalScans}</p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Migrations</p>
                <p className="text-2xl font-bold">{metrics.totalMigrations}</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comments</p>
                <p className="text-2xl font-bold">{metrics.totalComments}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approvals</p>
                <p className="text-2xl font-bold">{metrics.totalApprovals}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold">{metrics.activeMembers}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">{metrics.activeProjects}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.actor_id || 'Unknown'}</span>
                    {' '}
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No recent activity
            </p>
          )}
        </div>
      </div>

      {/* Most Active Members */}
      {metrics && metrics.mostActiveMembers && metrics.mostActiveMembers.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Most Active Members</h2>
          <div className="space-y-2">
            {metrics.mostActiveMembers.map((member: any, index: number) => (
              <div key={member.userId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">#{index + 1}</span>
                  <span className="text-sm">{member.userName || member.userId}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {member.activityCount} activities
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

