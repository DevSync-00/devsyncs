import { NormalizedSchema, Table, Column, Relationship, Constraint, SchemaDiff } from './types';
import { ScannedSchema } from '@/lib/schema-scanner';

// Browser-safe fallback for crypto.randomUUID in older environments
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Adapt dashboard's ScannedSchema format to NormalizedSchema for visualization.
 */
export function adaptScannedToNormalized(scanned?: ScannedSchema | null): NormalizedSchema {
  if (!scanned || !Array.isArray(scanned.tables)) {
    return {
      schemas: [],
      tables: [],
      relationships: [],
      enums: [],
      extensions: [],
      customTypes: [],
      dependencies: [],
    };
  }

  const tables: Table[] = scanned.tables.map((srcTable) => {
    const constraints: Constraint[] = [];
    const foreignColumns = new Set((srcTable.relationships || []).map((relationship) => relationship.column));

    const columns: Column[] = srcTable.columns.map((srcCol, idx) => {
      const isPrimaryKey = srcCol.constraints?.some(c => c.toUpperCase() === 'PRIMARY KEY') || false;
      const isUnique = srcCol.constraints?.some(c => c.toUpperCase() === 'UNIQUE') || false;

      if (isPrimaryKey) {
        constraints.push({
          id: `constraint:${srcTable.name}:pk:${srcCol.name}`,
          kind: 'PRIMARY_KEY',
          name: `${srcTable.name}_pkey`,
          tableName: srcTable.name,
          columns: [srcCol.name],
        });
      }

      return {
        id: `column:${srcTable.name}:${srcCol.name}`,
        name: srcCol.name,
        type: { id: srcCol.type, name: srcCol.type },
        nullable: srcCol.nullable,
        default: srcCol.defaultValue ?? null,
        isPrimaryKey,
        isForeignKey: foreignColumns.has(srcCol.name),
        isUnique,
        position: idx,
      };
    });

    // Foreign keys
    if (srcTable.relationships) {
      srcTable.relationships.forEach((rel) => {
        constraints.push({
          id: `constraint:${srcTable.name}:fk:${rel.column}:${rel.referencedTable}`,
          kind: 'FOREIGN_KEY',
          name: rel.constraintName || `fk_${srcTable.name}_${rel.referencedTable}_${rel.column}`,
          tableName: srcTable.name,
          columns: [rel.column],
          refTable: rel.referencedTable,
          refColumns: [rel.referencedColumn || 'id'],
        });
      });
    }

    return {
      id: `table:public:${srcTable.name}`,
      name: srcTable.name,
      schema: 'public',
      columns,
      indexes: [],
      constraints,
    };
  });

  // Global relationships list
  const relationships: Relationship[] = [];
  scanned.tables.forEach((srcTable) => {
    if (srcTable.relationships) {
      srcTable.relationships.forEach((rel) => {
        const isUniqueFK = srcTable.columns.find(c => c.name === rel.column)?.constraints?.some(c => c.toUpperCase() === 'UNIQUE') || false;

        relationships.push({
          id: `relationship:${srcTable.name}:${rel.column}:${rel.referencedTable}:${rel.referencedColumn || 'id'}`,
          name: rel.constraintName || `fk_${srcTable.name}_${rel.referencedTable}_${rel.column}`,
          sourceTable: rel.referencedTable,
          targetTable: srcTable.name,
          sourceColumn: rel.referencedColumn || 'id',
          targetColumn: rel.column,
          sourceCardinality: 'ONE',
          targetCardinality: isUniqueFK ? 'ONE' : 'MANY',
        });
      });
    }
  });

  return {
    schemas: [{ id: 'schema:public', name: 'public' }],
    tables,
    relationships,
    enums: [],
    extensions: [],
    customTypes: [],
    dependencies: [],
  };
}

/**
 * Compare two NormalizedSchema instances and generate a list of SchemaDiff changes.
 */
export function diffSchemas(before: NormalizedSchema, after: NormalizedSchema): SchemaDiff[] {
  const diffs: SchemaDiff[] = [];
  const asKey = (schema: string | undefined, name: string) => `${schema || 'public'}:${name}`;

  const beforeTables = new Map(before.tables.map((t) => [asKey(t.schema, t.name), t]));
  const afterTables = new Map(after.tables.map((t) => [asKey(t.schema, t.name), t]));

  // Table additions
  for (const [key, table] of afterTables) {
    if (!beforeTables.has(key)) {
      diffs.push({
        id: generateUUID(),
        action: 'add',
        target: 'table',
        payload: { name: table.name, schema: table.schema },
      });
    }
  }

  // Table removals
  for (const [key, table] of beforeTables) {
    if (!afterTables.has(key)) {
      diffs.push({
        id: generateUUID(),
        action: 'remove',
        target: 'table',
        payload: { name: table.name, schema: table.schema },
      });
    }
  }

  // Column additions/removals/changes
  for (const [key, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(key);
    if (!beforeTable) continue;

    const beforeCols = new Map(beforeTable.columns.map((c) => [c.name, c]));
    const afterCols = new Map(afterTable.columns.map((c) => [c.name, c]));

    // Columns added
    for (const [colName, col] of afterCols) {
      if (!beforeCols.has(colName)) {
        diffs.push({
          id: generateUUID(),
          action: 'add',
          target: 'column',
          payload: { table: afterTable.name, column: colName, after: col },
        });
      }
    }

    // Columns removed
    for (const [colName, col] of beforeCols) {
      if (!afterCols.has(colName)) {
        diffs.push({
          id: generateUUID(),
          action: 'remove',
          target: 'column',
          payload: { table: beforeTable.name, column: colName, before: col },
        });
      }
    }

    // Columns changed
    for (const [colName, col] of afterCols) {
      const prev = beforeCols.get(colName);
      if (!prev) continue;

      const changed =
        prev.type.name !== col.type.name ||
        prev.nullable !== col.nullable ||
        prev.default !== col.default ||
        prev.isArray !== col.isArray ||
        prev.isIdentity !== col.isIdentity;

      if (changed) {
        diffs.push({
          id: generateUUID(),
          action: 'change',
          target: 'column',
          payload: { table: afterTable.name, column: colName, before: prev, after: col },
        });
      }
    }
  }

  // Relationship changes
  const beforeRels = new Map(before.relationships.map((r) => [`${r.sourceTable}:${r.sourceColumn}->${r.targetTable}:${r.targetColumn}`, r]));
  const afterRels = new Map(after.relationships.map((r) => [`${r.sourceTable}:${r.sourceColumn}->${r.targetTable}:${r.targetColumn}`, r]));

  for (const [relKey, rel] of afterRels) {
    if (!beforeRels.has(relKey)) {
      diffs.push({
        id: generateUUID(),
        action: 'add',
        target: 'relationship',
        payload: rel,
      });
    }
  }

  for (const [relKey, rel] of beforeRels) {
    if (!afterRels.has(relKey)) {
      diffs.push({
        id: generateUUID(),
        action: 'remove',
        target: 'relationship',
        payload: rel,
      });
    }
  }

  return diffs;
}

/**
 * Merges two schemas (before/after) into a single NormalizedSchema representing
 * the union of both states. Used for the unified comparison ERD.
 */
export function mergeSchemas(before: NormalizedSchema, after: NormalizedSchema): NormalizedSchema {
  const mergedTables: Table[] = [];
  const afterTableMap = new Map(after.tables.map(t => [t.name, t]));
  const beforeTableMap = new Map(before.tables.map(t => [t.name, t]));

  // Combine table names
  const allTableNames = new Set([...beforeTableMap.keys(), ...afterTableMap.keys()]);

  allTableNames.forEach((name) => {
    const beforeT = beforeTableMap.get(name);
    const afterT = afterTableMap.get(name);

    if (beforeT && afterT) {
      // Table exists in both. Merge columns
      const mergedCols: Column[] = [];
      const beforeCols = new Map(beforeT.columns.map(c => [c.name, c]));
      const afterCols = new Map(afterT.columns.map(c => [c.name, c]));
      const allColNames = new Set([...beforeCols.keys(), ...afterCols.keys()]);

      allColNames.forEach((colName) => {
        const col = afterCols.get(colName) || beforeCols.get(colName);
        if (col) mergedCols.push(col);
      });

      mergedTables.push({
        ...afterT,
        columns: mergedCols,
      });
    } else if (afterT) {
      // Exists only in DB (after)
      mergedTables.push(afterT);
    } else if (beforeT) {
      // Exists only in Code (before)
      mergedTables.push(beforeT);
    }
  });

  // Combine relationships
  const relsMap = new Map<string, Relationship>();
  before.relationships.forEach(r => relsMap.set(`${r.sourceTable}.${r.sourceColumn}->${r.targetTable}.${r.targetColumn}`, r));
  after.relationships.forEach(r => relsMap.set(`${r.sourceTable}.${r.sourceColumn}->${r.targetTable}.${r.targetColumn}`, r));

  return {
    schemas: [{ id: generateUUID(), name: 'public' }],
    tables: mergedTables,
    relationships: Array.from(relsMap.values()),
    enums: [],
    extensions: [],
    customTypes: [],
    dependencies: [],
  };
}

export { generateUUID };

