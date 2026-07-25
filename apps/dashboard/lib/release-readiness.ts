export type ReleaseGateStatus = 'passed' | 'failed' | 'required';

export interface ReleaseGate {
  id: 'scan' | 'compatibility' | 'rehearsal' | 'rollback' | 'tests' | 'ownership' | 'approval';
  label: string;
  status: ReleaseGateStatus;
  reason: string;
  evidence?: string[];
}

export interface ReleaseReadinessInput {
  scanStatus?: string | null;
  changeSafety?: {
    score?: number;
    decision?: 'block' | 'review' | 'ready';
    gates?: Array<{ id: string; status: string; reason: string }>;
  } | null;
  impact?: {
    summary?: {
      breakingChanges?: number;
      ownerCoveragePercent?: number;
      testCoverageFiles?: number;
      affectedFiles?: number;
    };
  } | null;
  rehearsal?: {
    id: string;
    status: string;
    strategy: string;
    rollback_status?: string | null;
    test_results?: Array<{ id?: string; status: string; label: string; detail: string }> | null;
    evidence?: string[] | null;
  } | null;
  target: {
    id: string;
    name: string;
    tier: string;
    protected: boolean;
    requires_approval: boolean;
  };
  approvalCount?: number;
}

export interface ReleaseReadiness {
  score: number;
  decision: 'blocked' | 'approval_required' | 'ready';
  gates: ReleaseGate[];
  summary: string;
}

export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadiness {
  const impact = input.impact?.summary || {};
  const safetyGates = new Map((input.changeSafety?.gates || []).map((gate) => [gate.id, gate]));
  const rehearsalChecks = input.rehearsal?.test_results || [];
  const testCheck = rehearsalChecks.find((check) => check.id === 'tests' || /test/i.test(check.label));
  const scanPassed = input.scanStatus === 'completed';
  const compatibilityPassed =
    input.changeSafety?.decision !== 'block'
    && (impact.breakingChanges || 0) === 0
    && safetyGates.get('compatibility')?.status !== 'failed';
  const rehearsalPassed = input.rehearsal?.status === 'passed';
  const realRehearsal = rehearsalPassed && input.rehearsal?.strategy !== 'schema-only';
  const rollbackPassed = input.rehearsal?.rollback_status === 'passed';
  const testsPassed =
    (impact.affectedFiles || 0) === 0
    || (impact.testCoverageFiles || 0) > 0
    || testCheck?.status === 'passed';
  const ownersPassed =
    (impact.affectedFiles || 0) === 0
    || (impact.ownerCoveragePercent ?? 0) === 100;
  const needsApproval = input.target.protected || input.target.requires_approval;
  const approvalPassed = !needsApproval || (input.approvalCount || 0) > 0;

  const gates: ReleaseGate[] = [
    {
      id: 'scan',
      label: 'Current scan',
      status: scanPassed ? 'passed' : 'failed',
      reason: scanPassed ? 'The source scan completed successfully.' : 'A completed source scan is required.',
    },
    {
      id: 'compatibility',
      label: 'Application compatibility',
      status: compatibilityPassed ? 'passed' : 'failed',
      reason: compatibilityPassed
        ? 'No unresolved application compatibility blocker was detected.'
        : `${impact.breakingChanges || 0} breaking application change${impact.breakingChanges === 1 ? '' : 's'} remain.`,
    },
    {
      id: 'rehearsal',
      label: 'Preview rehearsal',
      status: realRehearsal ? 'passed' : rehearsalPassed ? 'required' : 'failed',
      reason: realRehearsal
        ? `${input.rehearsal?.strategy} rehearsal passed.`
        : rehearsalPassed
          ? 'Static preflight passed; a preview-database rehearsal is still required for protected targets.'
          : 'Run and pass a migration rehearsal.',
      evidence: input.rehearsal?.evidence || [],
    },
    {
      id: 'rollback',
      label: 'Rollback verification',
      status: rollbackPassed ? 'passed' : 'required',
      reason: rollbackPassed ? 'An executable rollback plan is available.' : 'Rollback must be verified before protected promotion.',
    },
    {
      id: 'tests',
      label: 'Compatibility tests',
      status: testsPassed ? 'passed' : 'required',
      reason: testsPassed ? 'Relevant test evidence is present.' : 'No related compatibility test evidence was found.',
    },
    {
      id: 'ownership',
      label: 'Owner coverage',
      status: ownersPassed ? 'passed' : 'required',
      reason: ownersPassed
        ? 'All affected paths have an identified owner.'
        : `${impact.ownerCoveragePercent || 0}% of affected files have an owner.`,
    },
    {
      id: 'approval',
      label: 'Human approval',
      status: approvalPassed ? 'passed' : 'required',
      reason: approvalPassed
        ? needsApproval ? 'A required approval was recorded.' : 'This target does not require approval.'
        : `${input.target.name} is protected and requires approval.`,
    },
  ];

  // Static rehearsal is sufficient for an unprotected development target, but
  // never for staging/production. This preserves a useful local workflow.
  if (!input.target.protected && input.target.tier === 'development' && rehearsalPassed) {
    const gate = gates.find((item) => item.id === 'rehearsal');
    if (gate) {
      gate.status = 'passed';
      gate.reason = 'Static preflight is accepted for this unprotected development target.';
    }
  }

  const failed = gates.filter((gate) => gate.status === 'failed').length;
  const required = gates.filter((gate) => gate.status === 'required').length;
  const score = Math.max(0, Math.round(((gates.length - failed - required * 0.5) / gates.length) * 100));
  const nonApprovalRequired = gates.filter((gate) => gate.id !== 'approval' && gate.status === 'required').length;
  const decision = failed || nonApprovalRequired
    ? 'blocked'
    : gates.find((gate) => gate.id === 'approval')?.status === 'required'
      ? 'approval_required'
      : 'ready';

  return {
    score,
    decision,
    gates,
    summary: decision === 'ready'
      ? `${input.target.name} is ready for an explicit deployment action.`
      : decision === 'approval_required'
        ? `Automated gates passed; ${input.target.name} is waiting for human approval.`
        : `${failed + nonApprovalRequired} release gate${failed + nonApprovalRequired === 1 ? '' : 's'} block promotion to ${input.target.name}.`,
  };
}
