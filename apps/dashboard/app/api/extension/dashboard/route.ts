import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { dataClientForUser, generateSlug, resolveUser } from '@/app/api/projects/utils';

export const dynamic = 'force-dynamic';

const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('team.create'), name: z.string().trim().min(2).max(100), slug: z.string().trim().min(2).max(100).optional() }),
  z.object({ action: z.literal('profile.update'), fullName: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal('notification.readAll') }),
]);

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { user, client } = auth;

  const projectsResult = await client
    .from('projects')
    .select('id,name,slug,schema_type,created_at,updated_at,team_id,config')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (projectsResult.error) return failure('Failed to load projects', projectsResult.error);

  const projects = projectsResult.data || [];
  const projectIds = projects.map((project: any) => project.id);
  const [scans, environments, memberships, notifications, profile] = await Promise.all([
    projectIds.length ? client.from('scan_reports').select('id,project_id,status,mismatches,created_at,completed_at').in('project_id', projectIds).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    projectIds.length ? client.from('project_environments').select('id,project_id,name,slug,tier,position,protected,requires_approval,created_at,updated_at').in('project_id', projectIds).order('position', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    client.from('team_members').select('role,team_id,teams(id,name,slug,created_at)').eq('user_id', user.id),
    client.from('notifications').select('id,type,title,message,read,created_at,metadata').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    client.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  const teams = (memberships.data || []).flatMap((membership: any) => {
    const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
    return team ? [{ ...team, role: membership.role }] : [];
  });
  const scanRows = scans.data || [];
  const mismatchTotal = scanRows.reduce((total: number, scan: any) => total + (Array.isArray(scan.mismatches) ? scan.mismatches.length : 0), 0);
  const requestedProjectId = request.nextUrl.searchParams.get('projectId');
  const activeProject = requestedProjectId ? projects.find((project: any) => project.id === requestedProjectId) : projects[0];
  let projectDetail: Record<string, unknown> | null = null;
  if (activeProject) {
    const activeScans = scanRows.filter((scan: any) => scan.project_id === activeProject.id);
    const scanIds = activeScans.map((scan: any) => scan.id);
    const [policies, promotions, migrations, reviews, activity] = await Promise.all([
      client.from('change_policies').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false }).limit(20),
      client.from('deployment_promotions').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false }).limit(20),
      scanIds.length ? client.from('migrations').select('*').in('scan_report_id', scanIds).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      client.from('pull_request_reviews').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false }).limit(20),
      client.from('activity_feed').select('*').eq('project_id', activeProject.id).order('created_at', { ascending: false }).limit(30),
    ]);
    const migrationRows = migrations.data || [];
    const migrationIds = migrationRows.map((migration: any) => migration.id);
    const [rehearsals, approvals, comments] = await Promise.all([
      migrationIds.length ? client.from('migration_rehearsals').select('*').in('migration_id', migrationIds).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      migrationIds.length ? client.from('approval_workflows').select('*').in('migration_id', migrationIds).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      scanIds.length ? client.from('mismatch_comments').select('*').in('scan_report_id', scanIds).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    ]);
    projectDetail = {
      project: activeProject,
      scans: activeScans,
      policies: policies.data || [], promotions: promotions.data || [], migrations: migrationRows,
      rehearsals: rehearsals.data || [], approvals: approvals.data || [], githubReviews: reviews.data || [],
      comments: comments.data || [], activity: activity.data || [],
    };
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email || '', fullName: profile.data?.full_name || '' },
    projects,
    scans: scanRows,
    environments: environments.data || [],
    teams,
    notifications: notifications.data || [],
    analytics: {
      projectCount: projects.length,
      scanCount: scanRows.length,
      mismatchTotal,
      healthyScans: scanRows.filter((scan: any) => scan.status === 'completed' && (!Array.isArray(scan.mismatches) || scan.mismatches.length === 0)).length,
    },
    projectDetail,
    capabilities: {
      projects: true, scans: true, environments: true, visualizer: true,
      teams: true, analytics: true, apiKeys: true, settings: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const body = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  const { user, client } = auth;

  if (body.data.action === 'team.create') {
    const slug = body.data.slug || generateSlug(body.data.name);
    const { data: team, error } = await client.from('teams').insert({ name: body.data.name, slug, created_by: user.id }).select('id,name,slug,created_at').single();
    if (error || !team) return failure('Failed to create team', error);
    const membership = await client.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'owner' });
    if (membership.error) {
      await client.from('teams').delete().eq('id', team.id);
      return failure('Failed to create team membership', membership.error);
    }
    return NextResponse.json({ success: true, team: { ...team, role: 'owner' } }, { status: 201 });
  }

  if (body.data.action === 'profile.update') {
    const result = await client.from('profiles').upsert({ id: user.id, full_name: body.data.fullName }, { onConflict: 'id' });
    if (result.error) return failure('Failed to update profile', result.error);
    return NextResponse.json({ success: true });
  }

  const result = await client.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  if (result.error) return failure('Failed to update notifications', result.error);
  return NextResponse.json({ success: true });
}

async function authenticate(request: NextRequest) {
  const supabase = await createClient();
  const user = await resolveUser(request, supabase);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, client: dataClientForUser(user, supabase) as any };
}

function failure(message: string, error: unknown) {
  console.error(`[extension-dashboard] ${message}`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
