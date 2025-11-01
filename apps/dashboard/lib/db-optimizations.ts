/**
 * Database query optimizations
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch projects with optimized query
 */
export async function fetchUserProjects(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 10
) {
  // Use count query for better performance
  return supabase
    .from('projects')
    .select('id, name, slug, schema_type, created_at, team_id', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch latest scan reports efficiently
 * Only fetches the latest scan per project
 */
export async function fetchLatestScans(
  supabase: SupabaseClient,
  projectIds: string[]
) {
  if (projectIds.length === 0) {
    return { data: [], error: null };
  }

  // Use a more efficient query - get latest scan per project
  // This could be optimized further with a database view or function
  const { data, error } = await supabase
    .from('scan_reports')
    .select('id, project_id, status, created_at, mismatches')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  // Group by project_id and keep only the latest
  const latestByProject = new Map();
  data?.forEach(scan => {
    if (!latestByProject.has(scan.project_id)) {
      latestByProject.set(scan.project_id, scan);
    }
  });

  return {
    data: Array.from(latestByProject.values()),
    error: null,
  };
}

/**
 * Fetch team count efficiently
 */
export async function fetchTeamCount(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
}

/**
 * Batch fetch multiple stats in parallel
 */
export async function fetchUserStats(
  supabase: SupabaseClient,
  userId: string
) {
  // Fetch all stats in parallel
  const [projectsResult, teamsResult] = await Promise.all([
    fetchUserProjects(supabase, userId, 6),
    fetchTeamCount(supabase, userId),
  ]);

  const projectIds = projectsResult.data?.map(p => p.id) || [];
  
  // Fetch scans only if we have projects
  const scansResult = projectIds.length > 0
    ? await fetchLatestScans(supabase, projectIds)
    : { data: [], error: null };

  return {
    projects: projectsResult.data || [],
    projectsCount: projectsResult.count || 0,
    teamsCount: teamsResult.count || 0,
    scans: scansResult.data || [],
  };
}

