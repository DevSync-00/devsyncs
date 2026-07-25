import { createHash } from 'crypto';

export interface PatchArtifact {
  id: string;
  file: string;
  kind: 'sql' | 'application' | 'test';
  format: 'unified-diff' | 'instructions';
  content: string;
  citations: string[];
  executable: boolean;
  requiresReview: boolean;
}

export interface PatchBundle {
  artifacts: PatchArtifact[];
  summary: { executable: number; reviewRequired: number; files: number };
  contentHash: string;
}

function sqlArtifact(mismatch: any, index: number): PatchArtifact | null {
  const fix = typeof mismatch.suggestedFix === 'string' ? mismatch.suggestedFix.trim() : '';
  if (!fix) return null;
  return {
    id: `sql-${index + 1}`,
    file: `devsync/migrations/${String(index + 1).padStart(3, '0')}_${mismatch.type}.sql`,
    kind: 'sql',
    format: 'unified-diff',
    content: `--- /dev/null\n+++ b/devsync/migrations/${String(index + 1).padStart(3, '0')}_${mismatch.type}.sql\n@@\n+-- Generated from scan evidence; review before execution.\n+${fix.replace(/\n/g, '\n+')}\n`,
    citations: [],
    executable: true,
    requiresReview: true,
  };
}

export function buildPatchBundle(version: any, report: any): PatchBundle {
  if (version.status !== 'approved') throw new Error('Only an approved immutable plan can generate patches.');
  const citations = Array.isArray(version.citations) ? version.citations : [];
  const artifacts: PatchArtifact[] = [];

  for (const [index, mismatch] of (report.mismatches || []).entries()) {
    const artifact = sqlArtifact(mismatch, index);
    if (artifact) {
      artifact.citations = citations
        .filter((item: any) => item.type === 'scan' && (!item.label || item.label === mismatch.table || item.label === mismatch.model))
        .map((item: any) => item.id);
      artifacts.push(artifact);
    }
  }

  for (const [index, proposal] of (version.patch_proposals || []).entries()) {
    const evidence = citations.filter((item: any) => proposal.citations?.includes(item.id));
    const excerpts = evidence
      .filter((item: any) => item.file === proposal.file)
      .map((item: any) => `${item.file}${item.line ? `:${item.line}` : ''}: ${item.detail}`);
    artifacts.push({
      id: `app-${index + 1}`,
      file: proposal.file,
      kind: 'application',
      format: 'instructions',
      content: [
        proposal.purpose,
        '',
        'Evidence:',
        ...(excerpts.length ? excerpts.map((item: string) => `- ${item}`) : ['- No complete source excerpt was captured. Rescan before generating a code diff.']),
        '',
        'DevSync withheld an automatic code diff because the full source file and syntax tree were not available.',
      ].join('\n'),
      citations: proposal.citations || [],
      executable: false,
      requiresReview: true,
    });
  }

  const result = {
    artifacts,
    summary: {
      executable: artifacts.filter((item) => item.executable).length,
      reviewRequired: artifacts.filter((item) => item.requiresReview).length,
      files: new Set(artifacts.map((item) => item.file)).size,
    },
  };
  return { ...result, contentHash: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}
