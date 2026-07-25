import { createHash } from 'crypto';
import { z } from 'zod';

const enrichedStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(10).max(1600),
  citations: z.array(z.string()).max(20),
});
const enrichedPatchSchema = z.object({
  file: z.string().min(1),
  purpose: z.string().min(10).max(1200),
  citations: z.array(z.string()).max(20),
});
const enrichedTestSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(10).max(1200),
  citations: z.array(z.string()).max(20),
});

export const enrichmentSchema = z.object({
  steps: z.array(enrichedStepSchema).min(1).max(12),
  patches: z.array(enrichedPatchSchema).max(100),
  tests: z.array(enrichedTestSchema).min(1).max(30),
  unresolvedQuestions: z.array(z.string().min(5).max(500)).max(30),
});

export type PlanEnrichment = z.infer<typeof enrichmentSchema>;

export function applyPlanEnrichment(version: any, candidate: unknown) {
  const enrichment = enrichmentSchema.parse(candidate);
  const allowedCitations = new Set((version.citations || []).map((item: any) => item.id));
  const allowedStepIds = new Set((version.steps || []).map((item: any) => item.id));
  const allowedFiles = new Set((version.patch_proposals || []).map((item: any) => item.file));

  if (enrichment.steps.some((step) => !allowedStepIds.has(step.id))) {
    throw new Error('AI response introduced an unknown plan step.');
  }
  if (enrichment.patches.some((patch) => !allowedFiles.has(patch.file))) {
    throw new Error('AI response introduced a file without deterministic evidence.');
  }
  const cited = [
    ...enrichment.steps.flatMap((item) => item.citations),
    ...enrichment.patches.flatMap((item) => item.citations),
    ...enrichment.tests.flatMap((item) => item.citations),
  ];
  if (cited.some((id) => !allowedCitations.has(id))) {
    throw new Error('AI response cited evidence that does not exist.');
  }

  const stepEnrichment = new Map(enrichment.steps.map((item) => [item.id, item]));
  const patchEnrichment = new Map(enrichment.patches.map((item) => [item.file, item]));
  const steps = (version.steps || []).map((step: any) => {
    const replacement = stepEnrichment.get(step.id);
    return replacement
      ? { ...step, description: replacement.description, citations: replacement.citations }
      : step;
  });
  const patchProposals = (version.patch_proposals || []).map((patch: any) => {
    const replacement = patchEnrichment.get(patch.file);
    return replacement
      ? { ...patch, purpose: replacement.purpose, citations: replacement.citations }
      : patch;
  });
  const testProposals = enrichment.tests.map((test, index) => ({
    name: test.name,
    type: version.test_proposals?.[index]?.type || 'compatibility',
    description: test.description,
    citations: test.citations,
  }));
  const content = {
    objective: version.objective,
    steps,
    citations: version.citations,
    patchProposals,
    testProposals,
    assumptions: version.assumptions,
    unresolvedQuestions: enrichment.unresolvedQuestions,
    confidence: Number(version.confidence),
    riskScore: version.risk_score,
    safetySnapshot: version.safety_snapshot,
  };
  return {
    ...content,
    contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
  };
}

export function buildEnrichmentPrompt(version: any): string {
  return JSON.stringify({
    task: 'Improve clarity and specificity of this database change plan. Return JSON only.',
    immutable_constraints: [
      'Use only existing step IDs.',
      'Use only existing patch file paths.',
      'Use only existing citation IDs.',
      'Do not add SQL execution, approval, risk, confidence, or safety claims.',
      'Do not claim tests, rehearsals, or rollbacks have passed.',
    ],
    response_shape: {
      steps: [{ id: 'existing-id', description: 'specific guidance', citations: ['existing-E-id'] }],
      patches: [{ file: 'existing-file', purpose: 'specific proposed edit', citations: ['existing-E-id'] }],
      tests: [{ name: 'test name', description: 'test behavior', citations: ['existing-E-id'] }],
      unresolvedQuestions: ['question'],
    },
    plan: {
      objective: version.objective,
      steps: version.steps,
      citations: version.citations,
      patches: version.patch_proposals,
      tests: version.test_proposals,
      unresolvedQuestions: version.unresolved_questions,
    },
  });
}
