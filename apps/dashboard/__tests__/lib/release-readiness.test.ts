import { evaluateReleaseReadiness } from '@/lib/release-readiness';

const base = {
  scanStatus: 'completed',
  changeSafety: { score: 100, decision: 'ready' as const, gates: [] },
  impact: {
    summary: {
      breakingChanges: 0,
      ownerCoveragePercent: 100,
      testCoverageFiles: 1,
      affectedFiles: 2,
    },
  },
  rehearsal: {
    id: 'rehearsal-1',
    status: 'passed',
    strategy: 'production-shaped',
    rollback_status: 'passed',
    test_results: [{ status: 'passed', label: 'Tests', detail: 'Passed' }],
    evidence: ['Rehearsal passed'],
  },
};

describe('evaluateReleaseReadiness', () => {
  it('allows an unprotected target when every gate passes', () => {
    const result = evaluateReleaseReadiness({
      ...base,
      target: {
        id: 'development',
        name: 'Development',
        tier: 'development',
        protected: false,
        requires_approval: false,
      },
    });

    expect(result.decision).toBe('ready');
    expect(result.score).toBe(100);
  });

  it('requires approval for a protected target', () => {
    const result = evaluateReleaseReadiness({
      ...base,
      target: {
        id: 'production',
        name: 'Production',
        tier: 'production',
        protected: true,
        requires_approval: true,
      },
    });

    expect(result.decision).toBe('approval_required');
    expect(result.gates.find((gate) => gate.id === 'approval')?.status).toBe('required');
  });

  it('does not accept static rehearsal for production', () => {
    const result = evaluateReleaseReadiness({
      ...base,
      rehearsal: { ...base.rehearsal, strategy: 'schema-only' },
      target: {
        id: 'production',
        name: 'Production',
        tier: 'production',
        protected: true,
        requires_approval: true,
      },
      approvalCount: 1,
    });

    expect(result.decision).toBe('blocked');
    expect(result.gates.find((gate) => gate.id === 'rehearsal')?.status).toBe('required');
  });

  it('blocks breaking application changes', () => {
    const result = evaluateReleaseReadiness({
      ...base,
      changeSafety: { score: 30, decision: 'block', gates: [] },
      impact: { summary: { ...base.impact.summary, breakingChanges: 2 } },
      target: {
        id: 'development',
        name: 'Development',
        tier: 'development',
        protected: false,
        requires_approval: false,
      },
    });

    expect(result.decision).toBe('blocked');
    expect(result.gates.find((gate) => gate.id === 'compatibility')?.status).toBe('failed');
  });
});
