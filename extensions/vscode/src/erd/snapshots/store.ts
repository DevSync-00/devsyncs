import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import type { LayoutState, NormalizedSchema } from '../schema/types'

export type SnapshotMeta = {
  id: string
  createdAt: string
  source?: string
  layoutId?: string
  note?: string
}

export type SnapshotRecord = {
  meta: SnapshotMeta
  schema: NormalizedSchema
  layout?: LayoutState
}

const MANIFEST_FILE = '.devsync/schemas/manifest.json'
const SNAPSHOT_DIR = '.devsync/schemas/snapshots'

type Manifest = {
  versions: SnapshotMeta[]
}

const ensureDir = async (path: string) => {
  await fs.mkdir(path, { recursive: true })
}

const resolvePath = (baseDir: string, rel: string) => join(baseDir, rel)

const loadManifest = async (baseDir: string): Promise<Manifest> => {
  try {
    const content = await fs.readFile(resolvePath(baseDir, MANIFEST_FILE), 'utf8')
    return JSON.parse(content) as Manifest
  } catch {
    return { versions: [] }
  }
}

const saveManifest = async (baseDir: string, manifest: Manifest) => {
  await ensureDir(dirname(resolvePath(baseDir, MANIFEST_FILE)))
  await fs.writeFile(
    resolvePath(baseDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )
}

export const saveSnapshot = async ({
  schema,
  layout,
  source,
  note,
  baseDir = process.cwd(),
}: {
  schema: NormalizedSchema
  layout?: LayoutState
  source?: string
  note?: string
  baseDir?: string
}): Promise<SnapshotMeta> => {
  await ensureDir(resolvePath(baseDir, SNAPSHOT_DIR))
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const meta: SnapshotMeta = { id, createdAt, source }

  const record: SnapshotRecord = { meta, schema, layout }
  const file = resolvePath(baseDir, join(SNAPSHOT_DIR, `${id}.json`))
  await fs.writeFile(file, JSON.stringify(record), 'utf8')

  const manifest = await loadManifest(baseDir)
  manifest.versions.unshift({ ...meta, note, layoutId: layout ? id : undefined })
  await saveManifest(baseDir, manifest)

  return meta
}

export const loadSnapshot = async (
  id: string,
  baseDir = process.cwd(),
): Promise<SnapshotRecord | null> => {
  const file = resolvePath(baseDir, join(SNAPSHOT_DIR, `${id}.json`))
  try {
    const content = await fs.readFile(file, 'utf8')
    return JSON.parse(content) as SnapshotRecord
  } catch {
    return null
  }
}

export const listSnapshots = async (
  baseDir = process.cwd(),
): Promise<SnapshotMeta[]> => {
  const manifest = await loadManifest(baseDir)
  return manifest.versions
}

/**
 * Persist layout changes for an existing snapshot.
 * If the snapshot file exists, it will be updated in place.
 */
export const saveSnapshotLayout = async (
  snapshotId: string,
  layout: LayoutState,
  baseDir = process.cwd(),
): Promise<boolean> => {
  const record = await loadSnapshot(snapshotId, baseDir)
  if (!record) return false
  const updated: SnapshotRecord = { ...record, layout }
  const file = resolvePath(baseDir, join(SNAPSHOT_DIR, `${snapshotId}.json`))
  await fs.writeFile(file, JSON.stringify(updated), 'utf8')

  // Update manifest layoutId for this snapshot
  const manifest = await loadManifest(baseDir)
  manifest.versions = manifest.versions.map((m) =>
    m.id === snapshotId ? { ...m, layoutId: snapshotId } : m,
  )
  await saveManifest(baseDir, manifest)
  return true
}

