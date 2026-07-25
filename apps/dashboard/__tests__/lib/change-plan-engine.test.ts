import { buildChangePlan } from '@/lib/change-plan-engine';

describe('change plan engine', () => {
  it('produces cited immutable-plan content from scan evidence', () => {
    const plan = buildChangePlan({
      mismatches: [{ type: 'extra_field' }],
      metadata: {
        applicationImpact: {
          summary: { score: 82, ownerCoveragePercent: 100, testCoverageFiles: 1 },
          references: [{ confidence: 0.9 }],
          findings: [{
            mismatchIndex: 0,
            object: 'users.email',
            risk: 'high',
            evidence: ['Column removal detected'],
            references: [{
              file: 'src/users.ts', line: 12, excerpt: 'select email from users',
              operation: 'read', kind: 'repository',
            }],
          }],
        },
        changeSafety: { decision: 'block', score: 40, diagnostics: [], gates: [] },
      },
    });

    expect(plan.steps.map((step) => step.phase)).toEqual(['expand', 'migrate', 'verify', 'contract']);
    expect(plan.citations.some((citation) => citation.file === 'src/users.ts')).toBe(true);
    expect(plan.patchProposals[0].file).toBe('src/users.ts');
    expect(plan.testProposals).toHaveLength(3);
    expect(plan.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('lowers confidence when owners and tests are missing', () => {
    const plan = buildChangePlan({
      mismatches: [],
      metadata: {
        applicationImpact: {
          summary: { score: 20, ownerCoveragePercent: 0, testCoverageFiles: 0 },
          references: [],
          findings: [],
        },
        changeSafety: {},
      },
    });
    expect(plan.confidence).toBeLessThan(0.7);
    expect(plan.unresolvedQuestions.length).toBeGreaterThan(1);
  });
});
