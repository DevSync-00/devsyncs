import { createHash } from 'crypto';

export interface ChangePlan {
  objective: string;
  steps: Array<{ id: string; phase: 'expand' | 'migrate' | 'verify' | 'contract'; title: string; description: string; citations: string[]; requiresApproval: boolean }>;
  citations: Array<{ id: string; type: 'scan' | 'code' | 'policy' | 'safety'; label: string; detail: string; file?: string; line?: number }>;
  patchProposals: Array<{ file: string; purpose: string; operation: 'modify' | 'create'; citations: string[] }>;
  testProposals: Array<{ name: string; type: 'compatibility' | 'migration' | 'rollback'; description: string; citations: string[] }>;
  assumptions: string[];
  unresolvedQuestions: string[];
  confidence: number;
  riskScore: number;
  safetySnapshot: Record<string, unknown>;
  contentHash: string;
}

export function buildChangePlan(report: any, objective?: string): ChangePlan {
  const metadata = report.metadata || {};
  const impact = metadata.applicationImpact || { summary: {}, findings: [] };
  const safety = metadata.changeSafety || { decision: 'review', diagnostics: [], gates: [] };
  const citations: ChangePlan['citations'] = [];
  const citationIds = new Map<string, string>();
  const cite = (key: string, citation: Omit<ChangePlan['citations'][number], 'id'>) => {
    if (citationIds.has(key)) return citationIds.get(key)!;
    const id = `E${citations.length + 1}`;
    citationIds.set(key, id);
    citations.push({ id, ...citation });
    return id;
  };

  const patchMap = new Map<string, ChangePlan['patchProposals'][number]>();
  for (const finding of impact.findings || []) {
    cite(`finding:${finding.mismatchIndex}`, {
      type: 'scan',
      label: finding.object,
      detail: finding.evidence?.[0] || `${finding.risk} risk schema finding`,
    });
    for (const reference of finding.references || []) {
      const evidenceId = cite(`ref:${reference.file}:${reference.line}`, {
        type: 'code',
        label: `${reference.file}:${reference.line}`,
        detail: reference.excerpt || `${reference.operation} reference to ${finding.object}`,
        file: reference.file,
        line: reference.line,
      });
      if (!['schema', 'migration', 'test'].includes(reference.kind)) {
        const current = patchMap.get(reference.file);
        if (current) current.citations = Array.from(new Set([...current.citations, evidenceId]));
        else patchMap.set(reference.file, {
          file: reference.file,
          purpose: `Preserve compatibility with the planned change to ${finding.object}.`,
          operation: 'modify',
          citations: [evidenceId],
        });
      }
    }
  }
  for (const diagnostic of safety.diagnostics || []) {
    cite(`safety:${diagnostic.id}`, {
      type: 'safety',
      label: diagnostic.title,
      detail: diagnostic.remediation,
    });
  }
  const allEvidence = citations.map((citation) => citation.id);
  const steps: ChangePlan['steps'] = [
    { id: 'expand', phase: 'expand', title: 'Introduce a backward-compatible schema', description: 'Add new structures without removing the current application contract.', citations: allEvidence.slice(0, 8), requiresApproval: false },
    { id: 'migrate', phase: 'migrate', title: 'Migrate application readers and writers', description: `Update ${patchMap.size} affected application file${patchMap.size === 1 ? '' : 's'} and backfill data in bounded batches.`, citations: allEvidence.filter((id) => citations.find((item) => item.id === id)?.type === 'code').slice(0, 12), requiresApproval: false },
    { id: 'verify', phase: 'verify', title: 'Rehearse and verify', description: 'Run compatibility tests, query replay, data assertions, and verified rollback in an isolated preview database.', citations: allEvidence.slice(0, 10), requiresApproval: true },
    { id: 'contract', phase: 'contract', title: 'Remove the retired contract', description: 'Remove old database objects only after usage reaches zero and owners approve.', citations: allEvidence.slice(0, 8), requiresApproval: true },
  ];
  const testProposals: ChangePlan['testProposals'] = [
    { name: 'Application compatibility', type: 'compatibility', description: 'Exercise every affected reader and writer against both expand and contract states.', citations: allEvidence.slice(0, 10) },
    { name: 'Migration rehearsal', type: 'migration', description: 'Apply the plan to a production-shaped preview and verify data assertions and query baselines.', citations: allEvidence.slice(0, 10) },
    { name: 'Rollback restoration', type: 'rollback', description: 'Execute rollback and require the final schema fingerprint to match the original.', citations: allEvidence.slice(0, 10) },
  ];
  const referenceConfidences = (impact.references || []).map((item: any) => Number(item.confidence || 0));
  const evidenceConfidence = referenceConfidences.length
    ? referenceConfidences.reduce((sum: number, value: number) => sum + value, 0) / referenceConfidences.length
    : 0.55;
  const ownerFactor = Number(impact.summary?.ownerCoveragePercent || 0) / 100;
  const testFactor = Number(impact.summary?.testCoverageFiles || 0) > 0 ? 1 : 0.65;
  const confidence = Math.max(0.2, Math.min(0.98, evidenceConfidence * 0.6 + ownerFactor * 0.2 + testFactor * 0.2));
  const unresolvedQuestions = [
    ...(ownerFactor < 1 ? ['Who owns the affected paths without CODEOWNERS coverage?'] : []),
    ...(testFactor < 1 ? ['Which test suite proves compatibility for the affected runtime paths?'] : []),
    'Are there external consumers or dynamic SQL references that static analysis cannot observe?',
  ];
  const result = {
    objective: objective?.trim() || `Safely resolve ${report.mismatches?.length || 0} schema difference${report.mismatches?.length === 1 ? '' : 's'}.`,
    steps,
    citations,
    patchProposals: Array.from(patchMap.values()),
    testProposals,
    assumptions: ['The scan report represents the intended source and target schemas.', 'Production execution remains disabled until all required gates pass.'],
    unresolvedQuestions,
    confidence: Number(confidence.toFixed(3)),
    riskScore: Number(impact.summary?.score || 0),
    safetySnapshot: { decision: safety.decision, score: safety.score, gates: safety.gates || [] },
  };
  return { ...result, contentHash: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}
