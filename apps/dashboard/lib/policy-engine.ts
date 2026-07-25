export type PolicyEnforcement = 'observe' | 'warn' | 'block';

export interface PolicyRule {
  id: 'no-breaking-changes' | 'require-owners' | 'require-tests' | 'require-real-rehearsal' | 'require-rollback' | 'max-risk-score' | 'required-approvals' | 'separation-of-duties';
  enabled?: boolean;
  value?: number | string | boolean;
  environments?: string[];
}

export interface PolicyContext {
  environmentTier?: string;
  riskScore: number;
  breakingChanges: number;
  ownerCoveragePercent: number;
  testEvidenceFiles: number;
  affectedFiles: number;
  rehearsalStrategy?: string | null;
  rehearsalStatus?: string | null;
  rollbackStatus?: string | null;
  approvalCount?: number;
  requesterApproved?: boolean;
}

export interface PolicyResult {
  status: 'passed' | 'warned' | 'blocked';
  violations: Array<{
    ruleId: PolicyRule['id'];
    message: string;
    actual: string | number | boolean;
    expected: string | number | boolean;
  }>;
  passedRules: string[];
}

export const recommendedPolicyRules: PolicyRule[] = [
  { id: 'no-breaking-changes', enabled: true },
  { id: 'require-owners', enabled: true, value: 100 },
  { id: 'require-tests', enabled: true },
  { id: 'require-real-rehearsal', enabled: true, environments: ['staging', 'production'] },
  { id: 'require-rollback', enabled: true, environments: ['staging', 'production'] },
  { id: 'max-risk-score', enabled: true, value: 70 },
  { id: 'required-approvals', enabled: true, value: 2, environments: ['production'] },
  { id: 'separation-of-duties', enabled: true, environments: ['production'] },
];

export function evaluatePolicy(
  rules: PolicyRule[],
  context: PolicyContext,
  enforcement: PolicyEnforcement,
): PolicyResult {
  const violations: PolicyResult['violations'] = [];
  const passedRules: string[] = [];
  for (const rule of rules.filter((item) => item.enabled !== false)) {
    if (rule.environments?.length && !rule.environments.includes(context.environmentTier || '')) continue;
    let violation: PolicyResult['violations'][number] | null = null;
    if (rule.id === 'no-breaking-changes' && context.breakingChanges > 0) {
      violation = { ruleId: rule.id, message: 'Breaking application changes are forbidden.', actual: context.breakingChanges, expected: 0 };
    }
    if (rule.id === 'require-owners' && context.affectedFiles > 0 && context.ownerCoveragePercent < Number(rule.value ?? 100)) {
      violation = { ruleId: rule.id, message: 'Affected paths do not have sufficient owner coverage.', actual: context.ownerCoveragePercent, expected: Number(rule.value ?? 100) };
    }
    if (rule.id === 'require-tests' && context.affectedFiles > 0 && context.testEvidenceFiles < 1) {
      violation = { ruleId: rule.id, message: 'At least one relevant test file is required.', actual: context.testEvidenceFiles, expected: 1 };
    }
    if (rule.id === 'require-real-rehearsal' && (context.rehearsalStatus !== 'passed' || context.rehearsalStrategy === 'schema-only')) {
      violation = { ruleId: rule.id, message: 'A real preview-database rehearsal must pass.', actual: context.rehearsalStrategy || 'none', expected: 'production-shaped' };
    }
    if (rule.id === 'require-rollback' && context.rollbackStatus !== 'passed') {
      violation = { ruleId: rule.id, message: 'Rollback verification must pass.', actual: context.rollbackStatus || 'not_tested', expected: 'passed' };
    }
    if (rule.id === 'max-risk-score' && context.riskScore > Number(rule.value ?? 70)) {
      violation = { ruleId: rule.id, message: 'Change risk exceeds the configured threshold.', actual: context.riskScore, expected: Number(rule.value ?? 70) };
    }
    if (rule.id === 'required-approvals' && context.approvalCount !== undefined && context.approvalCount < Number(rule.value ?? 1)) {
      violation = { ruleId: rule.id, message: 'The approval quorum has not been met.', actual: context.approvalCount, expected: Number(rule.value ?? 1) };
    }
    if (rule.id === 'separation-of-duties' && context.requesterApproved === true) {
      violation = { ruleId: rule.id, message: 'The requester cannot satisfy the independent approval requirement.', actual: true, expected: false };
    }
    if (violation) violations.push(violation);
    else passedRules.push(rule.id);
  }
  return {
    status: violations.length ? enforcement === 'block' ? 'blocked' : 'warned' : 'passed',
    violations,
    passedRules,
  };
}
