import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';
import ProjectsList from '@/components/ProjectsList';
import { ProjectCardSkeleton } from '@/components/LoadingSkeleton';
import { NotificationCenter } from '@/components/notifications';
import { getNotificationPreferences } from '@/lib/notifications';
import MissionControl from '@/components/dashboard/MissionControl';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Dashboard] Auth error:', authError);
      throw new Error(`Authentication error: ${authError.message}`);
    }

    if (!user) {
      return null;
    }

  // Fetch first page of projects (initial load)
  const initialPage = 1;
  const perPage = 12;

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, perPage - 1);

  if (projectsError) {
    console.error('[Dashboard] Error fetching projects:', projectsError);
    console.error('[Dashboard] Projects error details:', {
      code: projectsError.code,
      message: projectsError.message,
      hint: projectsError.hint,
      details: projectsError.details
    });
    
    // Check if this is likely an RLS recursion issue
    const isRLSError = 
      projectsError.message?.toLowerCase().includes('recursion') ||
      projectsError.message?.toLowerCase().includes('infinite') ||
      projectsError.code === 'P0001' ||
      projectsError.hint?.toLowerCase().includes('recursion');
    
    if (isRLSError) {
      throw new Error(`Failed to load projects: RLS policy recursion detected. Please run fix_team_members_rls.sql in Supabase SQL Editor.`);
    }
    
    throw new Error(`Failed to load projects: ${projectsError.message || 'Unknown error'}`);
  }

  // Fetch latest scan reports for initial projects
  // Only query for projects the user owns (not team projects) to avoid RLS recursion
  // TODO: After running fix_team_members_rls.sql, this can query all projects
  const projectIds = projects?.map(p => p.id) || [];
  const userOwnedProjectIds = projects?.filter(p => p.user_id === user.id).map(p => p.id) || [];
  
  const { data: latestScans, error: scansError } = userOwnedProjectIds.length > 0
    ? await supabase
        .from('scan_reports')
        .select('id, project_id, status, created_at, mismatches')
        .in('project_id', userOwnedProjectIds)
        .order('created_at', { ascending: false })
    : { data: null, error: null };

  if (scansError) {
    console.error('[Dashboard] Error fetching scan reports:', scansError);
    console.error('[Dashboard] Scan reports error details:', {
      code: scansError.code,
      message: scansError.message,
      hint: scansError.hint,
      details: scansError.details
    });
    // Don't throw - just log and continue without scans
  }

  const { data: notifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  if (notificationsError) {
    console.error('[Dashboard] Error fetching notifications:', notificationsError);
    // Don't throw - just log and continue without notifications
  }

  const { count: unreadCount, error: unreadCountError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (unreadCountError) {
    console.error('[Dashboard] Error fetching unread count:', unreadCountError);
    // Don't throw - just log and continue
  }

  let notificationPreferences = null;
  try {
    notificationPreferences = await getNotificationPreferences(supabase, user.id);
  } catch (error) {
    console.error('[Dashboard] Error fetching notification preferences:', error);
    // Don't throw - just log and continue
  }

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
            initialPreferences={notificationPreferences || {
              emailEnabled: true,
              inAppEnabled: true,
              teamDigestEnabled: false
            }}
          />
          <Link href="/dashboard/projects/new">
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <MissionControl projects={projects || []} scans={latestScans || []} />

      <div className="flex items-end justify-between border-t pt-8">
        <div>
          <h2 className="text-xl font-semibold">Your projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open a project to inspect drift, migrations, and history.</p>
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
  } catch (error: any) {
    console.error('[Dashboard] Fatal error:', error);
    console.error('[Dashboard] Error stack:', error?.stack);
    
    // Check if this is a fetch/network error that might be caused by RLS recursion
    const isFetchError = 
      error?.message?.includes('fetch failed') ||
      error?.message?.includes('TypeError') ||
      error?.name === 'TypeError';
    
    const isRLSError = 
      error?.message?.toLowerCase().includes('recursion') ||
      error?.message?.toLowerCase().includes('rls') ||
      error?.message?.toLowerCase().includes('policy');
    
    // Return error page instead of crashing
    return (
      <div className="space-y-8">
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {error?.message || 'An unexpected error occurred'}
          </p>
          {(isFetchError || isRLSError) && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                This error may be caused by RLS (Row Level Security) policy recursion.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Please run the SQL fix in your Supabase SQL Editor to resolve this issue:
              </p>
              <div className="space-y-2">
                <code className="block p-2 bg-muted rounded text-xs font-mono">
                  fix_team_members_rls.sql
                </code>
                <p className="text-xs text-muted-foreground">
                  This file is located in your project root directory. Copy its contents and run it in the Supabase SQL Editor.
                </p>
              </div>
            </div>
          )}
          {!isFetchError && !isRLSError && (
            <p className="text-xs text-muted-foreground mt-4">
              If you see "infinite recursion" errors, please run the SQL fix in Supabase:
              <br />
              <code className="mt-2 block p-2 bg-muted rounded text-xs">
                fix_team_members_rls.sql
              </code>
            </p>
          )}
        </div>
      </div>
    );
  }
}

