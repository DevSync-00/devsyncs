import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { buildChangePlan } from '@/lib/change-plan-engine';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const requestSchema = z.object({ objective: z.string().trim().min(3).max(500).optional() });

async function reportAccess(supabase: any, reportId: string, userId: string) {
  const { data: report } = await supabase
    .from('scan_reports')
    .select('*, project:projects(id, user_id, team_id)')
    .eq('id', reportId)
    .single();
  if (!report) return null;
  if (report.project.user_id === userId) return report;
  if (report.project.team_id) {
    const { data } = await supabase.rpc('check_team_membership', { team_uuid: report.project.team_id });
    if (data) return report;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const report = await reportAccess(supabase, params.id, user.id);
    if (!report) return NextResponse.json({ error: 'Scan report not found' }, { status: 404 });
    const { data, error } = await supabase
      .from('ai_change_plans')
      .select('*, versions:ai_change_plan_versions(*)')
      .eq('scan_report_id', params.id)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plans: data || [] });
  })(request);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const report = await reportAccess(supabase, params.id, user.id);
    if (!report) return NextResponse.json({ error: 'Scan report not found' }, { status: 404 });
    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid objective' }, { status: 400 });

    const generated = buildChangePlan(report, parsed.data.objective);
    const { data: master, error: masterError } = await supabase
      .from('ai_change_plans')
      .insert({
        project_id: report.project.id,
        scan_report_id: params.id,
        requested_by: user.id,
        objective: generated.objective,
        status: 'ready',
        plan: generated.steps,
        evidence: generated.citations,
        confidence: generated.confidence,
        risk_score: generated.riskScore,
        model_provider: 'deterministic',
        model_name: 'devsync-change-planner-v1',
      })
      .select()
      .single();
    if (masterError) return NextResponse.json({ error: masterError.message }, { status: 500 });
    const { data: version, error } = await supabase
      .from('ai_change_plan_versions')
      .insert({
        plan_id: master.id,
        version: 1,
        objective: generated.objective,
        steps: generated.steps,
        citations: generated.citations,
        patch_proposals: generated.patchProposals,
        test_proposals: generated.testProposals,
        assumptions: generated.assumptions,
        unresolved_questions: generated.unresolvedQuestions,
        confidence: generated.confidence,
        risk_score: generated.riskScore,
        safety_snapshot: generated.safetySnapshot,
        content_hash: generated.contentHash,
        generated_by: 'deterministic',
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: { ...master, versions: [version] } }, { status: 201 });
  })(request);
}
