import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { SchemaDiff } from '../types/index.js';

export function saveScanResults(
  projectPath: string,
  diff: SchemaDiff,
  outputPath?: string
): string {
  const resultsPath = outputPath || join(projectPath, '.devsync', 'scan-results.json');
  
  // Create directory if it doesn't exist
  const dir = join(resultsPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const timestamp = diff.metadata?.timestamp
    ? new Date(diff.metadata.timestamp).toISOString()
    : new Date().toISOString();

  const results = {
    timestamp: new Date().toISOString(),
    mismatches: diff.mismatches,
    warnings: diff.warnings,
    metadata: diff.metadata
      ? { ...diff.metadata, timestamp }
      : { timestamp },
    summary: {
      totalMismatches: diff.mismatches.length,
      errors: diff.mismatches.filter(m => m.severity === 'error').length,
      warnings: diff.mismatches.filter(m => m.severity === 'warning').length,
      info: diff.mismatches.filter(m => m.severity === 'info').length,
    },
  };

  writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
  return resultsPath;
}

export function getScanExitCode(diff: SchemaDiff, failOnWarnings: boolean = false): number {
  const hasErrors = diff.mismatches.some(m => m.severity === 'error');
  const hasWarnings = diff.mismatches.some(m => m.severity === 'warning');
  
  if (hasErrors) {
    return 1;
  }
  
  if (failOnWarnings && hasWarnings) {
    return 1;
  }
  
  return 0;
}

