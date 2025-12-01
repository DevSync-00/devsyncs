'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FolderKanban, Clock, ChevronLeft, ChevronRight, Loader2, Search, GitBranch, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectCardSkeleton } from './LoadingSkeleton';
import { useRealtimeTable, useTeamActivityNotifications } from '@/hooks/use-realtime';
import { useToast } from '@/hooks/use-toast';
import { formatErrorMessage } from '@/lib/error-utils';
import { executeSupabaseQuery } from '@/lib/supabase-client-wrapper';

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
  updated_at?: string;
  team_id?: string | null;
  user_id?: string;
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
  currentUserId: string;
}

export default function ProjectsList({ 
  initialProjects = [], 
  initialScans = [],
  page: initialPage = 1,
  perPage = 12,
  currentUserId,
}: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [scans, setScans] = useState<ScanReport[]>(initialScans);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(initialProjects.length);
  const [scanMap, setScanMap] = useState<Map<string, ScanReport>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const projectIdsRef = useRef(new Set(initialProjects.map(p => p.id)));
  const prevSearchQueryRef = useRef<string>('');
  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach((project) => {
      if (project.team_id) {
        ids.add(project.team_id);
      }
    });
    return Array.from(ids);
  }, [projects]);

  useTeamActivityNotifications(teamIds);

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
    projectIdsRef.current = new Set(projects.map(p => p.id));
  }, [projects]);

  const fetchProjects = useCallback(async (searchTerm?: string) => {
    if (!currentUserId) {
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      // When searching, fetch all projects (no pagination)
      // When not searching, use pagination
      const isSearching = Boolean(searchTerm?.trim());
      const from = isSearching ? undefined : (currentPage - 1) * perPage;
      const to = isSearching ? undefined : from! + perPage - 1;

      // Build the query
      let query = supabase
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      // Only apply range when not searching
      if (!isSearching && from !== undefined && to !== undefined) {
        query = query.range(from, to);
      }

      // Use retry wrapper for projects query
      const projectsResult = await executeSupabaseQuery(
        async () => {
          return await query;
        },
        { retries: 3, retryDelay: 1000 }
      );

      const projectsData = projectsResult.data || [];
      const count = projectsResult.count ?? projectsData.length;

      setProjects(projectsData);
      setTotalCount(count);

      if (projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);
        
        // Use retry wrapper for scans query
        const scansData = await executeSupabaseQuery(
          async () => {
            const result = await supabase
              .from('scan_reports')
              .select('id, project_id, status, created_at, mismatches')
              .in('project_id', projectIds)
              .order('created_at', { ascending: false });
            return result;
          },
          { retries: 3, retryDelay: 1000 }
        );

        const latestScansMap = new Map<string, ScanReport>();
        (scansData.data || []).forEach(scan => {
          if (!latestScansMap.has(scan.project_id)) {
            latestScansMap.set(scan.project_id, scan);
          }
        });
        setScanMap(latestScansMap);
        setScans(scansData.data || []);
      } else {
        setScans([]);
        setScanMap(new Map());
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      const formatted = formatErrorMessage(error, {
        operation: 'load',
        resource: 'projects',
      });
      toast({
        title: formatted.title,
        description: formatted.actionable || formatted.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentPage, perPage, toast]);

  // Fetch projects when page changes (non-search mode) or when search query changes
  useEffect(() => {
    if (!currentUserId) return;
    
    const prevSearchQuery = prevSearchQueryRef.current;
    const wasSearching = prevSearchQuery.trim().length > 0;
    const isSearching = searchQuery.trim().length > 0;
    const searchCleared = wasSearching && !isSearching;
    const searchQueryChanged = prevSearchQuery !== searchQuery;
    
    // Update ref for next render
    prevSearchQueryRef.current = searchQuery;
    
    // If searching, fetch all projects (only when search query actually changes, not on page changes)
    if (isSearching) {
      // Only fetch if search query changed, not if only currentPage changed
      if (searchQueryChanged) {
        fetchProjects(searchQuery);
      }
    } 
    // If not searching, fetch paginated projects when:
    // - Page changed from initial page (and search query hasn't changed)
    // - Initial load (no initial projects)
    // - Search was just cleared (transition from search to no-search)
    else if (searchCleared || initialProjects.length === 0 || (!searchQueryChanged && currentPage !== initialPage)) {
      fetchProjects();
    }
  }, [currentUserId, currentPage, initialPage, initialProjects.length, searchQuery, fetchProjects]);

  const refreshProjects = useCallback(() => {
    if (!currentUserId) return;
    // Pass current search query to maintain search state on refresh
    fetchProjects(searchQuery.trim() || undefined);
  }, [currentUserId, fetchProjects, searchQuery]);

  useRealtimeTable({
    table: 'projects',
    enabled: Boolean(currentUserId),
    onPayload: refreshProjects,
  });

  useRealtimeTable({
    table: 'scan_reports',
    enabled: Boolean(currentUserId),
    onPayload: refreshProjects,
  });

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    
    const query = searchQuery.toLowerCase();
    return projects.filter(project => {
      const nameMatch = project.name.toLowerCase().includes(query);
      const schemaMatch = formatSchemaType(project.schema_type).toLowerCase().includes(query);
      const slugMatch = project.slug?.toLowerCase().includes(query);
      
      return nameMatch || schemaMatch || slugMatch;
    });
  }, [projects, searchQuery]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Calculate pagination based on filtered results when searching, otherwise use totalCount
  const displayCount = searchQuery.trim() ? filteredProjects.length : totalCount;
  const totalPages = Math.ceil(displayCount / perPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Paginate filtered projects when searching
  const paginatedProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      // When not searching, use server-side pagination (projects already paginated)
      return filteredProjects;
    }
    // When searching, apply client-side pagination to filtered results
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, searchQuery, currentPage, perPage]);

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

  if (searchQuery && filteredProjects.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-card">
        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No projects found</h3>
        <p className="text-muted-foreground mb-6">
          No projects match your search query "{searchQuery}"
        </p>
        <Button variant="outline" onClick={() => setSearchQuery('')}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Search projects by name, schema type, or slug..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Found {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

      <div className="relative">
        {loading && projects.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="assertive">
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing projects...
            </div>
          </div>
        )}
        <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {paginatedProjects.map((project) => {
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
              <div className="mb-2">
                <h3 className="font-semibold text-lg">{project.name}</h3>
                {project.slug && (
                  <p className="text-xs text-muted-foreground mt-1">/{project.slug}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {formatSchemaType(project.schema_type)} schema
                </p>
              </div>
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, displayCount)} of {displayCount} project{displayCount !== 1 ? 's' : ''}
            {searchQuery.trim() && ` (filtered from ${totalCount} total)`}
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

