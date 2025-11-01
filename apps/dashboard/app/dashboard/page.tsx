import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban, Clock } from 'lucide-react';

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch latest scan reports for each project
  const projectIds = projects?.map(p => p.id) || [];
  const { data: latestScans } = projectIds.length > 0
    ? await supabase
        .from('scan_reports')
        .select('id, project_id, status, created_at, mismatches')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
    : { data: null };

  // Create a map of project_id to latest scan
  const scanMap = new Map();
  latestScans?.forEach(scan => {
    if (!scanMap.has(scan.project_id)) {
      scanMap.set(scan.project_id, scan);
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your projects and view scan reports
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button size="lg">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const latestScan = scanMap.get(project.id);
            const mismatchCount = latestScan?.mismatches?.length || 0;

            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <FolderKanban className="w-8 h-8 text-primary" />
                  {latestScan && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        latestScan.status === 'completed'
                          ? mismatchCount === 0
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {latestScan.status}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {formatSchemaType(project.schema_type)} schema
                </p>
                {latestScan && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(latestScan.created_at).toLocaleDateString()}
                    </div>
                    {mismatchCount > 0 && (
                      <span className="text-yellow-500">
                        {mismatchCount} mismatch{mismatchCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border border-border rounded-lg bg-card">
          <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first project to start syncing schemas
          </p>
          <Link href="/dashboard/projects/new">
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

