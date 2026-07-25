export function approvalRequirement(input: {
  riskScore: number;
  protected: boolean;
  tier: string;
}) {
  const highRisk = input.riskScore >= 70;
  const production = input.tier === 'production';
  return {
    requiredApprovals: highRisk && production ? 2 : input.protected || production ? 1 : 0,
    separationOfDuties: highRisk || production,
    confirmationText: `PROMOTE ${input.tier.toUpperCase()}`,
  };
}

export function executionDecision(input: {
  status: string;
  decision: string;
  gates: Array<{ id: string; status: string }>;
  approvalCount: number;
  requiredApprovals: number;
  confirmationText: string;
  suppliedConfirmation: string;
}) {
  const blockers = input.gates.filter((gate) => gate.status !== 'passed' && gate.id !== 'approval');
  if (blockers.length) return { allowed: false, reason: `${blockers.length} release gate(s) are unresolved.` };
  if (input.approvalCount < input.requiredApprovals) {
    return { allowed: false, reason: `${input.requiredApprovals - input.approvalCount} additional approval(s) required.` };
  }
  if (!['approved', 'ready', 'queued'].includes(input.status) && input.decision !== 'ready') {
    return { allowed: false, reason: `Promotion cannot execute from ${input.status}.` };
  }
  if (input.suppliedConfirmation !== input.confirmationText) {
    return { allowed: false, reason: `Type "${input.confirmationText}" to execute.` };
  }
  return { allowed: true, reason: 'All execution controls passed.' };
}
