import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AnalyticsDashboard from '@/components/reporting/AnalyticsDashboard';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { teamId?: string; period?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Verify team access if teamId provided
  if (searchParams.teamId) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', searchParams.teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      redirect('/dashboard/analytics');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive metrics and insights for your projects and teams
        </p>
      </div>

      <AnalyticsDashboard
        teamId={searchParams.teamId}
        period={searchParams.period || 'month'}
      />
    </div>
  );
}

