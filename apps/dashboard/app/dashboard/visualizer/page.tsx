import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Database, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/components/erd/ProjectSelector';
import { SchemaVisualizer } from '@/components/erd/SchemaVisualizer';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function VisualizerPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch all projects the user owns or has team access to
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    throw new Error('Failed to load projects');
  }

  const selectedProjectId = searchParams.projectId || '';
  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  let schemaData = null;
  let hasScans = false;

  if (selectedProjectId) {
    // 1. Try to fetch from schema_snapshots table (standard database layout snapshot)
    const { data: snapshot } = await supabase
      .from('schema_snapshots')
      .select('schema_data')
      .eq('project_id', selectedProjectId)
      .eq('schema_type', 'db')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot?.schema_data) {
      schemaData = snapshot.schema_data;
      hasScans = true;
    } else {
      // 2. Fallback to latest Scan Report db_schema
      const { data: scan } = await supabase
        .from('scan_reports')
        .select('db_schema')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scan?.db_schema) {
        schemaData = scan.db_schema;
        hasScans = true;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Visualization Studio
          </div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Database Visualizer
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Explore schema tables, primary/foreign key connections, and team layouts.
          </p>
        </div>

        {/* Project Selector */}
        <ProjectSelector
          projects={projects || []}
          selectedProjectId={selectedProjectId}
        />
      </div>


      {/* Main Display Container */}
      {!selectedProjectId ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border/60 bg-card/40 rounded-2xl">
          <Database className="w-12 h-12 text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold mb-1 text-foreground">No Project Selected</h3>
          <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
            Select a project from the dropdown in the top-right corner to visualize its connected database schema topology.
          </p>
        </div>
      ) : !hasScans ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border/60 bg-card/40 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-amber-500/60 mb-3" />
          <h3 className="text-base font-semibold mb-1 text-foreground">No Schema Data Available</h3>
          <p className="text-xs text-muted-foreground text-center max-w-sm mb-5">
            We couldn't find any database schema scans for <strong>{selectedProject?.name}</strong>. Please run a drift scan on your project first to extract the schema structure.
          </p>
          <Link href={`/dashboard/projects/${selectedProjectId}`}>
            <Button size="sm" className="font-mono text-xs">
              Go to Project Control
            </Button>
          </Link>
        </div>
      ) : (
        <div className="w-full">
          <SchemaVisualizer
            projectId={selectedProjectId}
            scannedSchema={schemaData}
          />
        </div>
      )}
    </div>
  );
}
