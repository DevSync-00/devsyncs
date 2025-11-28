import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';
import ProjectsList from '@/components/ProjectsList';
import { ProjectCardSkeleton } from '@/components/LoadingSkeleton';
import { NotificationCenter } from '@/components/notifications';
import { getNotificationPreferences } from '@/lib/notifications';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch first page of projects (initial load)
  const initialPage = 1;
  const perPage = 12;

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, perPage - 1);

  // Fetch latest scan reports for initial projects
  const projectIds = projects?.map(p => p.id) || [];
  const { data: latestScans } = projectIds.length > 0
    ? await supabase
        .from('scan_reports')
        .select('id, project_id, status, created_at, mismatches')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
    : { data: null };

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  const notificationPreferences = await getNotificationPreferences(supabase, user.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your projects and view scan reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter
            userId={user.id}
            initialNotifications={notifications || []}
            initialUnreadCount={unreadCount ?? 0}
            initialPreferences={notificationPreferences}
          />
          <Link href="/dashboard/projects/new">
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      }>
        <ProjectsList 
          initialProjects={projects || []} 
          initialScans={latestScans || []}
          page={initialPage}
          perPage={perPage}
          currentUserId={user.id}
        />
      </Suspense>
    </div>
  );
}

