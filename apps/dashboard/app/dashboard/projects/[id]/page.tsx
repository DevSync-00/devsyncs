import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ScanReportsListWithFilters from '@/components/ScanReportsListWithFilters';
import CodebaseStatus from '@/components/CodebaseStatus';
import ProjectAnalyticsWidget from '@/components/analytics/ProjectAnalyticsWidget';
import MigrationTimeline from '@/components/MigrationTimeline';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';
import { ScanReportSkeleton } from '@/components/LoadingSkeleton';

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
}: {
  params: { id: string };
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground mt-2">
            {formatSchemaType(project.schema_type)} schema • {project.slug}
          </p>
        </div>
        <Button size="lg">
          <Scan className="w-4 h-4 mr-2" />
          Run Scan
        </Button>
      </div>

      {/* Codebase Status */}
      <CodebaseStatus projectId={params.id} />

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

