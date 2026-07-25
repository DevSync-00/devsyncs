import { PostgresTransactionPreviewProvider } from './postgres-transaction';
import type { PreviewProvider } from './types';
import type { ManagedPreviewProvider } from './types';
import { NeonBranchPreviewProvider } from './neon-branch';

export function getPreviewProvider(id: string): PreviewProvider {
  if (id === 'postgres-transaction' || id === 'neon-branch') return new PostgresTransactionPreviewProvider();
  throw new Error(`Preview provider "${id}" is not available in this deployment.`);
}

export function getManagedPreviewProvider(id: string): ManagedPreviewProvider {
  if (id === 'neon-branch') return new NeonBranchPreviewProvider();
  throw new Error(`Managed preview provider "${id}" is not available in this deployment.`);
}

export type { PreviewProvider, PreviewRehearsalRequest, PreviewRehearsalResult, ManagedPreviewProvider, ManagedPreviewRequest, ManagedPreviewResource } from './types';
