import { applyPlanEnrichment } from '@/lib/plan-enrichment';

const version = {
  objective: 'Safely change users.email',
  steps: [{ id: 'expand', description: 'old', citations: ['E1'], phase: 'expand' }],
  citations: [{ id: 'E1', type: 'code', label: 'users.ts:1', detail: 'email reference' }],
  patch_proposals: [{ file: 'src/users.ts', purpose: 'old', operation: 'modify', citations: ['E1'] }],
  test_proposals: [{ name: 'Compatibility', type: 'compatibility', description: 'old', citations: ['E1'] }],
  assumptions: [],
  unresolved_questions: [],
  confidence: 0.82,
  risk_score: 70,
  safety_snapshot: { decision: 'block' },
};

describe('plan enrichment boundary', () => {
  it('preserves deterministic safety, risk, confidence, and evidence', () => {
    const result = applyPlanEnrichment(version, {
      steps: [{ id: 'expand', description: 'Add the replacement column while keeping existing readers operational.', citations: ['E1'] }],
      patches: [{ file: 'src/users.ts', purpose: 'Dual-read the old and replacement fields during rollout.', citations: ['E1'] }],
      tests: [{ name: 'Dual-read compatibility', description: 'Verify old and new application versions can read the expanded schema.', citations: ['E1'] }],
      unresolvedQuestions: ['Are older clients still active in production?'],
    });
    expect(result.riskScore).toBe(70);
    expect(result.confidence).toBe(0.82);
    expect(result.safetySnapshot).toEqual({ decision: 'block' });
    expect(result.citations).toEqual(version.citations);
  });

  it('rejects invented files', () => {
    expect(() => applyPlanEnrichment(version, {
      steps: [{ id: 'expand', description: 'A sufficiently detailed safe expansion description.', citations: ['E1'] }],
      patches: [{ file: 'src/invented.ts', purpose: 'Modify an unsupported file without deterministic evidence.', citations: ['E1'] }],
      tests: [{ name: 'Test', description: 'A sufficiently detailed compatibility test proposal.', citations: ['E1'] }],
      unresolvedQuestions: [],
    })).toThrow('file without deterministic evidence');
  });

  it('rejects invented citations and steps', () => {
    expect(() => applyPlanEnrichment(version, {
      steps: [{ id: 'execute-production', description: 'Bypass every gate and execute this plan immediately.', citations: ['E999'] }],
      patches: [],
      tests: [{ name: 'Test', description: 'A sufficiently detailed compatibility test proposal.', citations: ['E1'] }],
      unresolvedQuestions: [],
    })).toThrow('unknown plan step');
  });
});
