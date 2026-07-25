import { approvalRequirement, executionDecision } from '@/lib/promotion-control';

describe('promotion controls', () => {
  it('requires two independent approvals for high-risk production', () => {
    expect(approvalRequirement({ riskScore: 80, protected: true, tier: 'production' }))
      .toMatchObject({ requiredApprovals: 2, separationOfDuties: true, confirmationText: 'PROMOTE PRODUCTION' });
  });

  it('blocks execution when quorum or confirmation is missing', () => {
    expect(executionDecision({
      status: 'awaiting_approval', decision: 'approval_required', gates: [],
      approvalCount: 1, requiredApprovals: 2,
      confirmationText: 'PROMOTE PRODUCTION', suppliedConfirmation: 'yes',
    })).toEqual({ allowed: false, reason: '1 additional approval(s) required.' });
  });

  it('allows a fully gated explicitly confirmed execution', () => {
    expect(executionDecision({
      status: 'approved', decision: 'ready', gates: [{ id: 'scan', status: 'passed' }],
      approvalCount: 2, requiredApprovals: 2,
      confirmationText: 'PROMOTE PRODUCTION', suppliedConfirmation: 'PROMOTE PRODUCTION',
    }).allowed).toBe(true);
  });
});
