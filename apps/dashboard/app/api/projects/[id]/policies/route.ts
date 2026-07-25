import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { recommendedPolicyRules } from '@/lib/policy-engine';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).default('Recommended safety policy'),
  enforcement: z.enum(['observe', 'warn', 'block']).default('block'),
  useRecommendedRules: z.boolean().default(true),
});
const updateSchema = z.object({
  policyId: z.string().uuid(),
  enforcement: z.enum(['observe', 'warn', 'block']).optional(),
  rules: z.array(z.object({
    id: z.enum(['no-breaking-changes', 'require-owners', 'require-tests', 'require-real-rehearsal', 'require-rollback', 'max-risk-score', 'required-approvals', 'separation-of-duties']),
    enabled: z.boolean().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
    environments: z.array(z.string()).optional(),
  })).optional(),
});

async function accessProject(supabase: any, projectId: string, userId: string) {
  const { data: project } = await supabase.from('projects').select('id, user_id, team_id').eq('id', projectId).single();
  if (!project) return null;
  if (project.user_id === userId) return project;
  if (project.team_id) {
    const { data } = await supabase.rpc('check_team_membership', { team_uuid: project.team_id });
    if (data) return project;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await accessProject(supabase, params.id, user.id)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const { data, error } = await supabase
      .from('change_policies')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policies: data || [], recommendedRules: recommendedPolicyRules });
  })(request);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await accessProject(supabase, params.id, user.id)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid policy' }, { status: 400 });
    const { data, error } = await supabase
      .from('change_policies')
      .insert({
        project_id: params.id,
        name: parsed.data.name,
        description: 'Application compatibility, ownership, test, rehearsal, rollback, and risk controls.',
        enforcement: parsed.data.enforcement,
        rules: parsed.data.useRecommendedRules ? recommendedPolicyRules : [],
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policy: data }, { status: 201 });
  })(request);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const project = await accessProject(supabase, params.id, user.id);
    if (!project) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    let canEdit = project.user_id === user.id;
    if (!canEdit && project.team_id) {
      const { data: member } = await supabase.from('team_members').select('role').eq('team_id', project.team_id).eq('user_id', user.id).in('role', ['owner', 'admin']).maybeSingle();
      canEdit = Boolean(member);
    }
    if (!canEdit) return NextResponse.json({ error: 'Owner or admin permission is required.' }, { status: 403 });
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid policy update' }, { status: 400 });
    const changes = {
      ...(parsed.data.enforcement ? { enforcement: parsed.data.enforcement } : {}),
      ...(parsed.data.rules ? { rules: parsed.data.rules } : {}),
    };
    const { data, error } = await supabase.from('change_policies').update(changes).eq('id', parsed.data.policyId).eq('project_id', params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policy: data });
  })(request);
}
