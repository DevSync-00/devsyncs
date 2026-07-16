/**
 * Team Collaboration Metrics
 * 
 * Tracks per-developer and per-team activity metrics.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamActivityMetric {
  team_id?: string;
  user_id: string;
  project_id?: string;
  activity_date: string;
  scans_count: number;
  migrations_count: number;
  fixes_applied: number;
  reviews_count: number;
  comments_count: number;
}

export interface DeveloperActivity {
  userId: string;
  userName?: string;
  totalScans: number;
  totalMigrations: number;
  totalFixes: number;
  totalReviews: number;
  totalComments: number;
  activityScore: number;
  lastActivity: string;
}

export interface TeamCollaborationMetrics {
  teamId: string;
  totalMembers: number;
  activeMembers: number;
  totalActivity: number;
  activityByMember: Record<string, DeveloperActivity>;
  bottlenecks: string[]; // User IDs with low activity
  ownershipGaps: string[]; // Projects without clear ownership
}

/**
 * Record team activity
 */
export async function recordTeamActivity(
  supabase: SupabaseClient,
  activity: {
    team_id?: string;
    user_id: string;
    project_id?: string;
    activity_type: 'scan' | 'migration' | 'fix' | 'review' | 'comment';
  }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Get existing metric
  const { data: existing } = await supabase
    .from('team_activity_metrics')
    .select('*')
    .eq('user_id', activity.user_id)
    .eq('activity_date', today)
    .eq('team_id', activity.team_id || null)
    .eq('project_id', activity.project_id || null)
    .single();

  const updates: Partial<TeamActivityMetric> = {
    user_id: activity.user_id,
    activity_date: today,
  };

  if (activity.team_id) {
    updates.team_id = activity.team_id;
  }
  if (activity.project_id) {
    updates.project_id = activity.project_id;
  }

  if (existing) {
    // Update existing
    const fieldMap: Record<string, keyof TeamActivityMetric> = {
      scan: 'scans_count',
      migration: 'migrations_count',
      fix: 'fixes_applied',
      review: 'reviews_count',
      comment: 'comments_count',
    };

    const field = fieldMap[activity.activity_type];
    if (field) {
      updates[field] = (existing[field] || 0) + 1;
    }

    await supabase
      .from('team_activity_metrics')
      .update(updates)
      .eq('id', existing.id);
  } else {
    // Create new
    const newMetric: TeamActivityMetric = {
      user_id: activity.user_id,
      activity_date: today,
      ...(activity.team_id ? { team_id: activity.team_id } : {}),
      ...(activity.project_id ? { project_id: activity.project_id } : {}),
      scans_count: activity.activity_type === 'scan' ? 1 : 0,
      migrations_count: activity.activity_type === 'migration' ? 1 : 0,
      fixes_applied: activity.activity_type === 'fix' ? 1 : 0,
      reviews_count: activity.activity_type === 'review' ? 1 : 0,
      comments_count: activity.activity_type === 'comment' ? 1 : 0,
    };

    await supabase
      .from('team_activity_metrics')
      .insert(newMetric);
  }
}

/**
 * Get developer activity for a team
 */
export async function getDeveloperActivity(
  supabase: SupabaseClient,
  teamId: string,
  days: number = 30
): Promise<DeveloperActivity[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: metrics, error } = await supabase
    .from('team_activity_metrics')
    .select('*')
    .eq('team_id', teamId)
    .gte('activity_date', startDate.toISOString().split('T')[0]);

  if (error || !metrics) {
    return [];
  }

  // Aggregate by user
  const userActivity = new Map<string, DeveloperActivity>();

  for (const metric of metrics) {
    const existing = userActivity.get(metric.user_id) || {
      userId: metric.user_id,
      totalScans: 0,
      totalMigrations: 0,
      totalFixes: 0,
      totalReviews: 0,
      totalComments: 0,
      activityScore: 0,
      lastActivity: metric.activity_date,
    };

    existing.totalScans += metric.scans_count || 0;
    existing.totalMigrations += metric.migrations_count || 0;
    existing.totalFixes += metric.fixes_applied || 0;
    existing.totalReviews += metric.reviews_count || 0;
    existing.totalComments += metric.comments_count || 0;

    if (metric.activity_date > existing.lastActivity) {
      existing.lastActivity = metric.activity_date;
    }

    userActivity.set(metric.user_id, existing);
  }

  // Calculate activity scores
  const activities = Array.from(userActivity.values());
  for (const activity of activities) {
    // Weighted score: scans (1x), migrations (3x), fixes (2x), reviews (2x), comments (1x)
    activity.activityScore =
      activity.totalScans * 1 +
      activity.totalMigrations * 3 +
      activity.totalFixes * 2 +
      activity.totalReviews * 2 +
      activity.totalComments * 1;
  }

  // Sort by activity score
  return activities.sort((a, b) => b.activityScore - a.activityScore);
}

/**
 * Get team collaboration metrics
 */
export async function getTeamCollaborationMetrics(
  supabase: SupabaseClient,
  teamId: string,
  days: number = 30
): Promise<TeamCollaborationMetrics> {
  // Get team members
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId);

  const memberIds = members?.map(m => m.user_id) || [];

  // Get developer activity
  const developerActivity = await getDeveloperActivity(supabase, teamId, days);

  // Get active members (those with activity in the period)
  const activeMemberIds = new Set(developerActivity.map(d => d.userId));
  const activeMembers = activeMemberIds.size;

  // Calculate total activity
  const totalActivity = developerActivity.reduce(
    (sum, d) => sum + d.activityScore,
    0
  );

  // Build activity by member map
  const activityByMember: Record<string, DeveloperActivity> = {};
  developerActivity.forEach(d => {
    activityByMember[d.userId] = d;
  });

  // Identify bottlenecks (members with low activity)
  const avgActivity = developerActivity.length > 0
    ? totalActivity / developerActivity.length
    : 0;
  const bottlenecks = developerActivity
    .filter(d => d.activityScore < avgActivity * 0.3)
    .map(d => d.userId);

  // Identify ownership gaps (projects without clear ownership)
  // This would require analyzing project activity patterns
  const ownershipGaps: string[] = [];

  return {
    teamId,
    totalMembers: memberIds.length,
    activeMembers,
    totalActivity,
    activityByMember,
    bottlenecks,
    ownershipGaps,
  };
}

/**
 * Get collaboration patterns across environments
 */
export async function getCollaborationPatterns(
  supabase: SupabaseClient,
  teamId: string,
  days: number = 30
): Promise<{
  byProject: Record<string, { contributors: number; activity: number }>;
  byDay: Record<string, number>;
  peakHours: number[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: metrics } = await supabase
    .from('team_activity_metrics')
    .select('*')
    .eq('team_id', teamId)
    .gte('activity_date', startDate.toISOString().split('T')[0]);

  // Group by project
  const byProject: Record<string, { contributors: Set<string>; activity: number }> = {};
  metrics?.forEach(m => {
    if (m.project_id) {
      const existing = byProject[m.project_id] || { contributors: new Set<string>(), activity: 0 };
      existing.contributors.add(m.user_id);
      existing.activity +=
        (m.scans_count || 0) +
        (m.migrations_count || 0) * 3 +
        (m.fixes_applied || 0) * 2 +
        (m.reviews_count || 0) * 2 +
        (m.comments_count || 0);
      byProject[m.project_id] = existing;
    }
  });

  // Convert to final format
  const byProjectFinal: Record<string, { contributors: number; activity: number }> = {};
  Object.entries(byProject).forEach(([projectId, data]) => {
    byProjectFinal[projectId] = {
      contributors: data.contributors.size,
      activity: data.activity,
    };
  });

  // Group by day
  const byDay: Record<string, number> = {};
  metrics?.forEach(m => {
    byDay[m.activity_date] = (byDay[m.activity_date] || 0) + 1;
  });

  // Calculate peak hours (would need timestamp data, simplified here)
  const peakHours: number[] = [9, 10, 11, 14, 15, 16]; // Typical work hours

  return {
    byProject: byProjectFinal,
    byDay,
    peakHours,
  };
}

