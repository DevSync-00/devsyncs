import type { LayoutState, NormalizedSchema } from './schema/types'
import type { SchemaDiff } from './diff/types'
import type { SnapshotMeta } from './snapshots/store'

export type ToWebviewMessage =
  | {
      type: 'loadSnapshot'
      schema: NormalizedSchema
      diff?: SchemaDiff[]
      layout?: LayoutState
      meta?: { id: string; createdAt: string; note?: string }
    }
  | {
      type: 'status'
      message: string
    }
  | {
      type: 'snapshotList'
      snapshots: SnapshotMeta[]
    }

export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'requestLatest' }
  | { type: 'requestSnapshot'; id: string }
  | { type: 'saveLayout'; layout: LayoutState; snapshotId?: string }

