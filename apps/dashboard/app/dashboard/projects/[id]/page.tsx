import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Check, Database, Github, Pencil, Scan, ShieldCheck } from 'lucide-react';
import ScanReportsListWithFilters from '@/components/ScanReportsListWithFilters';
import CodebaseStatus from '@/components/CodebaseStatus';
import ProjectAnalyticsWidget from '@/components/analytics/ProjectAnalyticsWidget';
import MigrationTimeline from '@/components/MigrationTimeline';
import RunScanButton from '@/components/RunScanButton';
import { ScanReportSkeleton } from '@/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import EnvironmentPipeline from '@/components/environments/EnvironmentPipeline';
import PolicyCenter from '@/components/policies/PolicyCenter';
import PullRequestReviews from '@/components/github/PullRequestReviews';

function formatSchemaType(schemaType: string): string {
  const schemaTypeMap: Record<string, string> = {
    'prisma': 'Prisma',
    'supabase': 'Supabase',
    'typeorm': 'TypeORM',
    'kysely': 'Kysely',
    'sequelize': 'Sequelize',
    'drizzle': 'Drizzle ORM',
    'django': 'Django',
    'sqlalchemy': 'SQLAlchemy',
    'raw-sql': 'Raw SQL',
  };
  return schemaTypeMap[schemaType] || schemaType;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { onboarding?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Check if user has access (owner or team member)
  // Use RPC function to avoid RLS recursion issues
  const isOwner = project.user_id === user.id;
  let hasTeamAccess = false;

  if (project.team_id && !isOwner) {
    const { data: isMember } = await supabase
      .rpc('check_team_membership', { team_uuid: project.team_id });
    
    hasTeamAccess = !!isMember;
  }

  if (!isOwner && !hasTeamAccess) {
    redirect('/dashboard');
  }

  // Fetch scan reports for this project
  const { data: scanReports } = await supabase
    .from('scan_reports')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      {searchParams?.onboarding === 'scan' && (!scanReports || scanReports.length === 0) ? (
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600"><ShieldCheck className="h-4 w-4" /> Setup complete · read-only access</div>
              <h2 className="mt-2 text-xl font-semibold">Now compare code with the live database</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">The first scan reads both schemas, traces affected application code, and prepares a reviewable plan. It never executes SQL.</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" /><Github className="h-3.5 w-3.5" /> Repository connected</span>
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" /><Database className="h-3.5 w-3.5" /> Database verified</span>
                <span className="inline-flex items-center gap-1"><Scan className="h-3.5 w-3.5 text-primary" /> Scan next</span>
              </div>
            </div>
            <RunScanButton projectId={params.id} guided />
          </div>
        </section>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground mt-2">
            {formatSchemaType(project.schema_type)} schema • {project.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && (
            <Link href={`/dashboard/projects/${params.id}/edit`}>
              <Button variant="outline">
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
          <RunScanButton projectId={params.id} />
        </div>
      </div>

      {/* Codebase Status */}
      <CodebaseStatus projectId={params.id} />

      {/* Environment topology and release promotion */}
      <EnvironmentPipeline projectId={params.id} />

      <PolicyCenter projectId={params.id} />

      <PullRequestReviews projectId={params.id} />

      {/* Analytics Widget */}
      <Suspense fallback={<div className="h-32 bg-card border rounded-lg animate-pulse" />}>
        <ProjectAnalyticsWidget projectId={params.id} />
      </Suspense>

      {/* Migration Timeline */}
      <div className="border-t border-border pt-8">
        <Suspense fallback={<div className="h-64 bg-card border rounded-lg animate-pulse" />}>
          <MigrationTimeline projectId={params.id} />
        </Suspense>
      </div>

      <div className="border-t border-border pt-8">
        <h2 className="text-xl font-semibold mb-4">Scan Reports</h2>
        <Suspense fallback={
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ScanReportSkeleton key={i} />
            ))}
          </div>
        }>
          <ScanReportsListWithFilters reports={scanReports || []} projectId={params.id} />
        </Suspense>
      </div>
    </div>
  );
}

