import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import ScanReportsList from '@/components/ScanReportsList';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';

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

  // Check if user has access
  if (project.user_id !== user.id) {
    // TODO: Check team access
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

      <div className="border-t border-border pt-8">
        <h2 className="text-xl font-semibold mb-4">Scan Reports</h2>
        <ScanReportsList reports={scanReports || []} projectId={params.id} />
      </div>
    </div>
  );
}

