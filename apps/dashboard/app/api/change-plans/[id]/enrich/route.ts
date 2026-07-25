import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { applyPlanEnrichment, buildEnrichmentPrompt } from '@/lib/plan-enrichment';
import { requestStructuredPlan } from '@/lib/structured-model';
import { withRateLimit } from '@/lib/rate-limit-middleware';

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: plan } = await supabase
      .from('ai_change_plans')
      .select('*, project:projects(id, user_id, team_id), versions:ai_change_plan_versions(*)')
      .eq('id', params.id)
      .single();
    if (!plan) return NextResponse.json({ error: 'Change plan not found' }, { status: 404 });
    let allowed = plan.project.user_id === user.id;
    if (!allowed && plan.project.team_id) {
      const { data } = await supabase.rpc('check_team_membership', { team_uuid: plan.project.team_id });
      allowed = Boolean(data);
    }
    if (!allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const latest = [...(plan.versions || [])].sort((a: any, b: any) => b.version - a.version)[0];
    if (!latest) return NextResponse.json({ error: 'Plan has no source version' }, { status: 409 });
    if (latest.status === 'approved') {
      return NextResponse.json({ error: 'Approved versions are frozen. Create a new plan before enrichment.' }, { status: 409 });
    }

    try {
      const modelResult = await requestStructuredPlan(buildEnrichmentPrompt(latest));
      const enriched = applyPlanEnrichment(latest, modelResult.value);
      const nextVersion = Number(latest.version) + 1;
      const { data: version, error } = await supabase
        .from('ai_change_plan_versions')
        .insert({
          plan_id: plan.id,
          version: nextVersion,
          objective: enriched.objective,
          steps: enriched.steps,
          citations: enriched.citations,
          patch_proposals: enriched.patchProposals,
          test_proposals: enriched.testProposals,
          assumptions: enriched.assumptions,
          unresolved_questions: enriched.unresolvedQuestions,
          confidence: enriched.confidence,
          risk_score: enriched.riskScore,
          safety_snapshot: enriched.safetySnapshot,
          content_hash: enriched.contentHash,
          generated_by: 'ai-enriched',
          model_provider: modelResult.provider,
          model_name: modelResult.model,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('ai_change_plan_versions').update({ status: 'superseded' }).eq('id', latest.id);
      await supabase.from('ai_change_plans').update({
        plan: enriched.steps,
        evidence: enriched.citations,
        model_provider: modelResult.provider,
        model_name: modelResult.model,
      }).eq('id', plan.id);
      return NextResponse.json({ version }, { status: 201 });
    } catch (error) {
      return NextResponse.json({
        error: 'AI enrichment was rejected',
        details: error instanceof Error ? error.message : String(error),
        deterministicVersionPreserved: true,
      }, { status: 422 });
    }
  })(request);
}
