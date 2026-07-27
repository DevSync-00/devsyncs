import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';
import ProjectsList from '@/components/ProjectsList';
import { ProjectCardSkeleton } from '@/components/LoadingSkeleton';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const initialPage = 1;
  const perPage = 12;

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, perPage - 1);

  const userOwnedProjectIds = projects?.filter(p => p.user_id === user.id).map(p => p.id) || [];

  const { data: latestScans } = userOwnedProjectIds.length > 0
    ? await supabase
        .from('scan_reports')
        .select('id, project_id, status, created_at, mismatches')
        .in('project_id', userOwnedProjectIds)
        .order('created_at', { ascending: false })
    : { data: null };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Repositories & Repos
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Connected Projects</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitor schema state and drift status across all connected database projects.
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button size="sm" className="font-mono text-xs">
            <Plus className="w-4 h-4 mr-2" />
            Connect project
          </Button>
        </Link>
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
