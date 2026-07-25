import { evaluatePolicy, recommendedPolicyRules } from '@/lib/policy-engine';

const safeContext = {
  environmentTier: 'production',
  riskScore: 25,
  breakingChanges: 0,
  ownerCoveragePercent: 100,
  testEvidenceFiles: 2,
  affectedFiles: 4,
  rehearsalStrategy: 'production-shaped',
  rehearsalStatus: 'passed',
  rollbackStatus: 'passed',
};

describe('policy engine', () => {
  it('passes a fully evidenced production change', () => {
    const result = evaluatePolicy(recommendedPolicyRules, safeContext, 'block');
    expect(result.status).toBe('passed');
    expect(result.violations).toHaveLength(0);
  });

  it('blocks breaking and unowned changes under block enforcement', () => {
    const result = evaluatePolicy(recommendedPolicyRules, {
      ...safeContext,
      breakingChanges: 2,
      ownerCoveragePercent: 50,
      riskScore: 90,
    }, 'block');

    expect(result.status).toBe('blocked');
    expect(result.violations.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(['no-breaking-changes', 'require-owners', 'max-risk-score']),
    );
  });

  it('reports violations without blocking in warn mode', () => {
    const result = evaluatePolicy(recommendedPolicyRules, {
      ...safeContext,
      rehearsalStrategy: 'schema-only',
    }, 'warn');

    expect(result.status).toBe('warned');
    expect(result.violations[0].ruleId).toBe('require-real-rehearsal');
  });

  it('applies environment-scoped rules only to matching tiers', () => {
    const result = evaluatePolicy(recommendedPolicyRules, {
      ...safeContext,
      environmentTier: 'development',
      rehearsalStatus: null,
      rehearsalStrategy: null,
      rollbackStatus: null,
    }, 'block');

    expect(result.violations.map((item) => item.ruleId)).not.toContain('require-real-rehearsal');
    expect(result.violations.map((item) => item.ruleId)).not.toContain('require-rollback');
  });

  it('enforces approval quorum and separation when promotion context is present', () => {
    const result = evaluatePolicy(recommendedPolicyRules, {
      ...safeContext,
      approvalCount: 1,
      requesterApproved: true,
    }, 'block');
    expect(result.violations.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(['required-approvals', 'separation-of-duties']),
    );
  });
});
