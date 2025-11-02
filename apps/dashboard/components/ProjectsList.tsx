'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FolderKanban, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCardSkeleton } from './LoadingSkeleton';

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

interface Project {
  id: string;
  name: string;
  slug: string;
  schema_type: string;
  created_at: string;
}

interface ScanReport {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  mismatches: any[];
}

interface ProjectsListProps {
  initialProjects?: Project[];
  initialScans?: ScanReport[];
  page?: number;
  perPage?: number;
}

export default function ProjectsList({ 
  initialProjects = [], 
  initialScans = [],
  page: initialPage = 1,
  perPage = 12
}: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [scans, setScans] = useState<ScanReport[]>(initialScans);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(initialProjects.length);
  const [scanMap, setScanMap] = useState<Map<string, ScanReport>>(new Map());

  useEffect(() => {
    // Initialize scan map
    const map = new Map();
    scans.forEach(scan => {
      if (!map.has(scan.project_id)) {
        map.set(scan.project_id, scan);
      }
    });
    setScanMap(map);
  }, [scans]);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        // Fetch total count
        const { count } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        setTotalCount(count || 0);

        // Fetch paginated projects
        const from = (currentPage - 1) * perPage;
        const to = from + perPage - 1;

        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (projectsError) throw projectsError;

        setProjects(projectsData || []);

        // Fetch latest scans for these projects
        if (projectsData && projectsData.length > 0) {
          const projectIds = projectsData.map(p => p.id);
          const { data: scansData } = await supabase
            .from('scan_reports')
            .select('id, project_id, status, created_at, mismatches')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false });

          // Create scan map (latest per project)
          const latestScansMap = new Map<string, ScanReport>();
          scansData?.forEach(scan => {
            if (!latestScansMap.has(scan.project_id)) {
              latestScansMap.set(scan.project_id, scan);
            }
          });
          setScanMap(latestScansMap);
          setScans(scansData || []);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentPage !== initialPage || initialProjects.length === 0) {
      fetchProjects();
    }
  }, [currentPage, initialPage, initialProjects.length, perPage]);

  const totalPages = Math.ceil(totalCount / perPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  if (loading && projects.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-card">
        <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first project to start syncing schemas
        </p>
        <Link href="/dashboard/projects/new">
          <Button size="lg">Create Project</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const latestScan = scanMap.get(project.id);
          const mismatchCount = (latestScan?.mismatches as any[])?.length || 0;

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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, totalCount)} of {totalCount} projects
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={!hasPrevPage || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground px-4">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={!hasNextPage || loading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

