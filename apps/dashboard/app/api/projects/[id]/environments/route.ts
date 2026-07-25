import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const environmentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  tier: z.enum(['local', 'preview', 'development', 'staging', 'production']),
  position: z.number().int().min(0).max(100).optional(),
  protected: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
});

const initializeSchema = z.object({ initializeDefaults: z.literal(true) });

async function authorizeProject(supabase: any, projectId: string, userId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, team_id')
    .eq('id', projectId)
    .single();
  if (!project) return { allowed: false, status: 404 };
  if (project.user_id === userId) return { allowed: true, status: 200 };
  if (project.team_id) {
    const { data: isMember } = await supabase.rpc('check_team_membership', { team_uuid: project.team_id });
    if (isMember) return { allowed: true, status: 200 };
  }
  return { allowed: false, status: 403 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await authorizeProject(supabase, params.id, user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.status === 404 ? 'Project not found' : 'Access denied' }, { status: access.status });
    }

    const { data, error } = await supabase
      .from('project_environments')
      .select('*, current_scan_report:scan_reports(id, status, created_at, mismatches, metadata)')
      .eq('project_id', params.id)
      .order('position');

    if (error) {
      const migrationMissing = error.code === '42P01' || /project_environments/i.test(error.message || '');
      return NextResponse.json(
        {
          error: migrationMissing ? 'Environment platform migration is not installed' : 'Failed to load environments',
          migrationRequired: migrationMissing,
          environments: [],
        },
        { status: migrationMissing ? 503 : 500 },
      );
    }

    return NextResponse.json({ environments: data || [] });
  })(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await authorizeProject(supabase, params.id, user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.status === 404 ? 'Project not found' : 'Access denied' }, { status: access.status });
    }

    const body = await req.json();
    const initialize = initializeSchema.safeParse(body);
    if (initialize.success) {
      const defaults = [
        { project_id: params.id, name: 'Development', slug: 'development', tier: 'development', position: 10, protected: false, requires_approval: false },
        { project_id: params.id, name: 'Preview', slug: 'preview', tier: 'preview', position: 15, protected: false, requires_approval: false },
        { project_id: params.id, name: 'Staging', slug: 'staging', tier: 'staging', position: 20, protected: true, requires_approval: true },
        { project_id: params.id, name: 'Production', slug: 'production', tier: 'production', position: 30, protected: true, requires_approval: true },
      ];
      const { data, error } = await supabase
        .from('project_environments')
        .upsert(defaults, { onConflict: 'project_id,slug', ignoreDuplicates: true })
        .select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ environments: data || [] }, { status: 201 });
    }

    const payload = environmentSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.issues[0]?.message || 'Invalid environment' }, { status: 400 });
    }
    const value = payload.data;
    const slug = value.slug || value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await supabase
      .from('project_environments')
      .insert({
        project_id: params.id,
        name: value.name,
        slug,
        tier: value.tier,
        position: value.position || 0,
        protected: value.protected ?? value.tier === 'production',
        requires_approval: value.requiresApproval ?? ['staging', 'production'].includes(value.tier),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ environment: data }, { status: 201 });
  })(request);
}
