import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';
import { buildPatchBundle } from '@/lib/patch-generator';

async function loadVersion(supabase: any, id: string, userId: string) {
  const { data: version } = await supabase
    .from('ai_change_plan_versions')
    .select('*, plan:ai_change_plans(*, project:projects(id, user_id, team_id), report:scan_reports(*))')
    .eq('id', id)
    .single();
  if (!version) return null;
  if (version.plan.project.user_id === userId) return version;
  if (version.plan.project.team_id) {
    const { data } = await supabase.rpc('check_team_membership', { team_uuid: version.plan.project.team_id });
    if (data) return version;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const version = await loadVersion(supabase, params.id, user.id);
    if (!version) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
    const { data, error } = await supabase
      .from('change_patch_bundles')
      .select('*')
      .eq('plan_version_id', params.id)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bundles: data || [] });
  })(request);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const version = await loadVersion(supabase, params.id, user.id);
    if (!version) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
    if (!version.plan.report) return NextResponse.json({ error: 'The source scan report is unavailable' }, { status: 409 });

    let generated;
    try {
      generated = buildPatchBundle(version, version.plan.report);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Patch generation failed' }, { status: 409 });
    }
    const record = {
      plan_version_id: version.id,
      project_id: version.plan.project.id,
      generated_by: user.id,
      artifacts: generated.artifacts,
      summary: generated.summary,
      content_hash: generated.contentHash,
    };
    const { data, error } = await supabase.from('change_patch_bundles').insert(record).select().single();
    if (error?.code === '23505') {
      const { data: existing } = await supabase
        .from('change_patch_bundles')
        .select('*')
        .eq('plan_version_id', version.id)
        .eq('content_hash', generated.contentHash)
        .single();
      return NextResponse.json({ bundle: existing, duplicate: true });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bundle: data }, { status: 201 });
  })(request);
}
