/**
 * Schema Drift Analyzer
 * 
 * Analyzes schema changes over time to detect drift trends, velocity, and risk patterns.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SchemaSnapshot {
  id: string;
  project_id: string;
  schema_type: 'code' | 'db';
  schema_data: any;
  schema_hash: string;
  mismatch_count: number;
  created_at: string;
}

export interface DriftMetric {
  id: string;
  project_id: string;
  snapshot_date: string;
  total_tables: number;
  total_columns: number;
  changed_tables: number;
  changed_columns: number;
  new_tables: number;
  new_columns: number;
  removed_tables: number;
  removed_columns: number;
  drift_velocity: number;
}

export interface DriftTrend {
  date: string;
  totalChanges: number;
  velocity: number;
  riskLevel: 'low' | 'medium' | 'high';
  details: {
    newTables: number;
    removedTables: number;
    changedTables: number;
    newColumns: number;
    removedColumns: number;
    changedColumns: number;
  };
}

export interface FrequentlyChangingObject {
  objectName: string;
  objectType: 'table' | 'column';
  changeCount: number;
  firstSeenAt: string;
  lastChangedAt: string;
  riskLevel: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Calculate drift between two schema snapshots
 */
export function calculateDrift(
  previousSchema: any,
  currentSchema: any
): {
  newTables: string[];
  removedTables: string[];
  changedTables: string[];
  newColumns: { table: string; column: string }[];
  removedColumns: { table: string; column: string }[];
  changedColumns: { table: string; column: string }[];
} {
  const previousTables = new Set(Object.keys(previousSchema.tables || {}));
  const currentTables = new Set(Object.keys(currentSchema.tables || {}));

  const newTables = Array.from(currentTables).filter(t => !previousTables.has(t));
  const removedTables = Array.from(previousTables).filter(t => !currentTables.has(t));
  const changedTables: string[] = [];

  // Find changed tables (tables that exist in both but have different structure)
  for (const table of Array.from(previousTables).filter(t => currentTables.has(t))) {
    const prevTable = previousSchema.tables[table];
    const currTable = currentSchema.tables[table];
    
    if (JSON.stringify(prevTable) !== JSON.stringify(currTable)) {
      changedTables.push(table);
    }
  }

  // Find column changes
  const newColumns: { table: string; column: string }[] = [];
  const removedColumns: { table: string; column: string }[] = [];
  const changedColumns: { table: string; column: string }[] = [];

  for (const table of Array.from(previousTables).filter(t => currentTables.has(t))) {
    const prevTable = previousSchema.tables[table] || {};
    const currTable = currentSchema.tables[table] || {};
    
    const prevColumns = new Set(Object.keys(prevTable.columns || {}));
    const currColumns = new Set(Object.keys(currTable.columns || {}));

    // New columns
    for (const col of Array.from(currColumns).filter(c => !prevColumns.has(c))) {
      newColumns.push({ table, column: col });
    }

    // Removed columns
    for (const col of Array.from(prevColumns).filter(c => !currColumns.has(c))) {
      removedColumns.push({ table, column: col });
    }

    // Changed columns
    for (const col of Array.from(prevColumns).filter(c => currColumns.has(c))) {
      if (JSON.stringify(prevTable.columns[col]) !== JSON.stringify(currTable.columns[col])) {
        changedColumns.push({ table, column: col });
      }
    }
  }

  // Columns in new tables
  for (const table of newTables) {
    const currTable = currentSchema.tables[table] || {};
    for (const col of Object.keys(currTable.columns || {})) {
      newColumns.push({ table, column: col });
    }
  }

  // Columns in removed tables
  for (const table of removedTables) {
    const prevTable = previousSchema.tables[table] || {};
    for (const col of Object.keys(prevTable.columns || {})) {
      removedColumns.push({ table, column: col });
    }
  }

  return {
    newTables,
    removedTables,
    changedTables,
    newColumns,
    removedColumns,
    changedColumns,
  };
}

/**
 * Calculate drift velocity (changes per day)
 */
export function calculateDriftVelocity(
  metrics: DriftMetric[]
): number {
  if (metrics.length < 2) return 0;

  // Sort by date
  const sorted = [...metrics].sort((a, b) => 
    new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const daysDiff = Math.max(1, 
    (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const totalChanges = sorted.reduce((sum, m) => 
    sum + m.changed_tables + m.changed_columns + m.new_tables + m.new_columns + m.removed_tables + m.removed_columns,
    0
  );

  return totalChanges / daysDiff;
}

/**
 * Detect accelerating drift (risk signal)
 */
export function detectAcceleratingDrift(
  trends: DriftTrend[]
): { isAccelerating: boolean; acceleration: number; riskLevel: 'low' | 'medium' | 'high' } {
  if (trends.length < 3) {
    return { isAccelerating: false, acceleration: 0, riskLevel: 'low' };
  }

  // Calculate velocity changes
  const velocities = trends.map(t => t.velocity);
  const velocityChanges: number[] = [];
  
  for (let i = 1; i < velocities.length; i++) {
    velocityChanges.push(velocities[i] - velocities[i - 1]);
  }

  // Check if velocity is consistently increasing
  const avgChange = velocityChanges.reduce((a, b) => a + b, 0) / velocityChanges.length;
  const isAccelerating = avgChange > 0 && velocityChanges.filter(c => c > 0).length >= velocityChanges.length * 0.6;

  // Determine risk level
  const currentVelocity = velocities[velocities.length - 1];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  if (isAccelerating) {
    if (currentVelocity > 10 || avgChange > 2) {
      riskLevel = 'high';
    } else if (currentVelocity > 5 || avgChange > 1) {
      riskLevel = 'medium';
    }
  }

  return {
    isAccelerating,
    acceleration: avgChange,
    riskLevel,
  };
}

/**
 * Store schema snapshot
 */
export async function storeSchemaSnapshot(
  supabase: SupabaseClient,
  projectId: string,
  schemaType: 'code' | 'db',
  schemaData: any,
  mismatchCount: number = 0,
  userId?: string
): Promise<string | null> {
  // Calculate hash
  const schemaString = JSON.stringify(schemaData);
  const hash = await calculateHash(schemaString);

  const { data, error } = await supabase
    .from('schema_snapshots')
    .insert({
      project_id: projectId,
      schema_type: schemaType,
      schema_data: schemaData,
      schema_hash: hash,
      mismatch_count: mismatchCount,
      created_by: userId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error storing schema snapshot:', error);
    return null;
  }

  return data.id;
}

/**
 * Calculate and store drift metrics
 */
export async function calculateAndStoreDriftMetrics(
  supabase: SupabaseClient,
  projectId: string,
  currentSchema: any,
  previousSchema?: any
): Promise<string | null> {
  if (!previousSchema) {
    // Get previous snapshot
    const { data: previousSnapshot } = await supabase
      .from('schema_snapshots')
      .select('schema_data')
      .eq('project_id', projectId)
      .eq('schema_type', 'db')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!previousSnapshot) {
      // First snapshot, no drift to calculate
      return null;
    }

    previousSchema = previousSnapshot.schema_data;
  }

  const drift = calculateDrift(previousSchema, currentSchema);

  const totalTables = Object.keys(currentSchema.tables || {}).length;
  const totalColumns = Object.values(currentSchema.tables || {}).reduce(
    (sum: number, table: any) => sum + Object.keys(table.columns || {}).length,
    0
  );

  const snapshotDate = new Date().toISOString().split('T')[0];

  // Calculate velocity (get previous metrics)
  const { data: previousMetrics } = await supabase
    .from('schema_drift_metrics')
    .select('*')
    .eq('project_id', projectId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  let driftVelocity = 0;
  if (previousMetrics) {
    const daysDiff = Math.max(1,
      (new Date(snapshotDate).getTime() - new Date(previousMetrics.snapshot_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalChanges = drift.newTables.length + drift.removedTables.length + 
                        drift.changedTables.length + drift.newColumns.length + 
                        drift.removedColumns.length + drift.changedColumns.length;
    driftVelocity = totalChanges / daysDiff;
  }

  const { data, error } = await supabase
    .from('schema_drift_metrics')
    .upsert({
      project_id: projectId,
      snapshot_date: snapshotDate,
      total_tables: totalTables,
      total_columns: totalColumns,
      changed_tables: drift.changedTables.length,
      changed_columns: drift.changedColumns.length,
      new_tables: drift.newTables.length,
      new_columns: drift.newColumns.length,
      removed_tables: drift.removedTables.length,
      removed_columns: drift.removedColumns.length,
      drift_velocity: driftVelocity,
    }, {
      onConflict: 'project_id,snapshot_date',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error storing drift metrics:', error);
    return null;
  }

  // Update frequently changing objects
  await updateFrequentlyChangingObjects(supabase, projectId, drift);

  return data.id;
}

/**
 * Update frequently changing objects tracking
 */
async function updateFrequentlyChangingObjects(
  supabase: SupabaseClient,
  projectId: string,
  drift: ReturnType<typeof calculateDrift>
): Promise<void> {
  const now = new Date().toISOString();

  // Update tables
  for (const table of [...drift.changedTables, ...drift.newTables, ...drift.removedTables]) {
    const { data: existing } = await supabase
      .from('frequently_changing_objects')
      .select('*')
      .eq('project_id', projectId)
      .eq('object_type', 'table')
      .eq('object_name', table)
      .single();

    if (existing) {
      await supabase
        .from('frequently_changing_objects')
        .update({
          change_count: existing.change_count + 1,
          last_changed_at: now,
          risk_level: calculateRiskLevel(existing.change_count + 1),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('frequently_changing_objects')
        .insert({
          project_id: projectId,
          object_type: 'table',
          object_name: table,
          change_count: 1,
          first_seen_at: now,
          last_changed_at: now,
          risk_level: 'low',
        });
    }
  }

  // Update columns
  for (const col of [...drift.changedColumns, ...drift.newColumns, ...drift.removedColumns]) {
    const objectName = `${col.table}.${col.column}`;
    const { data: existing } = await supabase
      .from('frequently_changing_objects')
      .select('*')
      .eq('project_id', projectId)
      .eq('object_type', 'column')
      .eq('object_name', objectName)
      .single();

    if (existing) {
      await supabase
        .from('frequently_changing_objects')
        .update({
          change_count: existing.change_count + 1,
          last_changed_at: now,
          risk_level: calculateRiskLevel(existing.change_count + 1),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('frequently_changing_objects')
        .insert({
          project_id: projectId,
          object_type: 'column',
          object_name: objectName,
          change_count: 1,
          first_seen_at: now,
          last_changed_at: now,
          risk_level: 'low',
        });
    }
  }
}

function calculateRiskLevel(changeCount: number): 'low' | 'medium' | 'high' {
  if (changeCount >= 10) return 'high';
  if (changeCount >= 5) return 'medium';
  return 'low';
}

/**
 * Calculate SHA-256 hash
 */
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get drift trends for a project
 */
export async function getDriftTrends(
  supabase: SupabaseClient,
  projectId: string,
  days: number = 30
): Promise<DriftTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: metrics, error } = await supabase
    .from('schema_drift_metrics')
    .select('*')
    .eq('project_id', projectId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (error || !metrics) {
    return [];
  }

  return metrics.map((m: any) => ({
    date: m.snapshot_date,
    totalChanges: m.changed_tables + m.changed_columns + m.new_tables + 
                 m.new_columns + m.removed_tables + m.removed_columns,
    velocity: Number(m.drift_velocity) || 0,
    riskLevel: determineRiskLevel(m.drift_velocity),
    details: {
      newTables: m.new_tables,
      removedTables: m.removed_tables,
      changedTables: m.changed_tables,
      newColumns: m.new_columns,
      removedColumns: m.removed_columns,
      changedColumns: m.changed_columns,
    },
  }));
}

function determineRiskLevel(velocity: number): 'low' | 'medium' | 'high' {
  if (velocity >= 10) return 'high';
  if (velocity >= 5) return 'medium';
  return 'low';
}

/**
 * Get frequently changing objects
 */
export async function getFrequentlyChangingObjects(
  supabase: SupabaseClient,
  projectId: string,
  limit: number = 10
): Promise<FrequentlyChangingObject[]> {
  const { data, error } = await supabase
    .from('frequently_changing_objects')
    .select('*')
    .eq('project_id', projectId)
    .order('change_count', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((obj: any) => ({
    objectName: obj.object_name,
    objectType: obj.object_type as 'table' | 'column',
    changeCount: obj.change_count,
    firstSeenAt: obj.first_seen_at,
    lastChangedAt: obj.last_changed_at,
    riskLevel: obj.risk_level as 'low' | 'medium' | 'high',
    trend: 'stable' as const, // Could be calculated from historical data
  }));
}

