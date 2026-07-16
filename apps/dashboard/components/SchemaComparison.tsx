'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Tabs component not available, using buttons instead
import { Plus, Minus, Edit, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SchemaComparisonProps {
  codeSchema?: any;
  dbSchema?: any;
  mismatches?: any[];
}

export default function SchemaComparison({
  codeSchema,
  dbSchema,
  mismatches = [],
}: SchemaComparisonProps) {
  const [selectedView, setSelectedView] = useState<'tables' | 'columns' | 'indexes' | 'relationships'>('tables');
  const [filterType, setFilterType] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const normalizedMismatches = mismatches.map(normalizeMismatch);
  const filteredMismatches = normalizedMismatches.filter((m) => {
    if (filterType === 'all') return true;
    return m.severity === filterType;
  });

  const codeTables = normalizeTables(codeSchema?.tables);
  const dbTables = normalizeTables(dbSchema?.tables);

  // Build comparison data
  const tableComparison = buildTableComparison(codeTables, dbTables, filteredMismatches);
  const relationshipComparison = buildRelationshipComparison(codeTables, dbTables, filteredMismatches);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schema Comparison</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            variant={filterType === 'error' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('error')}
          >
            Errors
          </Button>
          <Button
            variant={filterType === 'warning' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('warning')}
          >
            Warnings
          </Button>
          <Button
            variant={filterType === 'info' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('info')}
          >
            Info
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b">
          <Button
            variant={selectedView === 'tables' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedView('tables')}
          >
            Tables
          </Button>
          <Button
            variant={selectedView === 'columns' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedView('columns')}
          >
            Columns
          </Button>
          <Button
            variant={selectedView === 'indexes' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedView('indexes')}
          >
            Indexes
          </Button>
          <Button
            variant={selectedView === 'relationships' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedView('relationships')}
          >
            Relationships
          </Button>
        </div>

        {selectedView === 'tables' && (
          <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Code Schema</h3>
              <div className="space-y-2">
                {codeTables.map((table: any) => {
                  const mismatch = filteredMismatches.find(
                    (m) => m.model === table.name && m.type === 'missing_table'
                  );
                  return (
                    <div
                      key={table.name}
                      className={`p-2 rounded border ${
                        mismatch ? 'border-yellow-500 bg-yellow-500/10' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {mismatch ? (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">{table.name}</span>
                      </div>
                      {table.columns && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {table.columns.length} columns
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Database Schema</h3>
              <div className="space-y-2">
                {dbTables.map((table: any) => {
                  const mismatch = filteredMismatches.find(
                    (m) => m.model === table.name && m.type === 'extra_table'
                  );
                  return (
                    <div
                      key={table.name}
                      className={`p-2 rounded border ${
                        mismatch ? 'border-yellow-500 bg-yellow-500/10' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {mismatch ? (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium">{table.name}</span>
                      </div>
                      {table.columns && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {table.columns.length} columns
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          </div>
        )}

        {selectedView === 'columns' && (
          <div className="space-y-4">
          <div className="space-y-4">
            {tableComparison.map((table) => (
              <Card key={table.name} className="p-4">
                <h3 className="font-semibold mb-4">{table.name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Code Schema</div>
                    <div className="space-y-1">
                      {table.codeColumns.map((col: any) => {
                        const mismatch = filteredMismatches.find(
                          (m) => m.model === table.name && m.field === col.name
                        );
                        return (
                          <div
                            key={col.name}
                            className={`p-2 rounded text-sm ${
                              mismatch ? 'bg-yellow-500/10 border border-yellow-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {mismatch ? (
                                <Minus className="w-3 h-3 text-yellow-500" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              )}
                              <span className="font-medium">{col.name}</span>
                              <span className="text-muted-foreground">({col.type})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Database Schema</div>
                    <div className="space-y-1">
                      {table.dbColumns.map((col: any) => {
                        const mismatch = filteredMismatches.find(
                          (m) => m.model === table.name && m.field === col.name
                        );
                        return (
                          <div
                            key={col.name}
                            className={`p-2 rounded text-sm ${
                              mismatch ? 'bg-yellow-500/10 border border-yellow-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {mismatch ? (
                                <Plus className="w-3 h-3 text-yellow-500" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              )}
                              <span className="font-medium">{col.name}</span>
                              <span className="text-muted-foreground">({col.type})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          </div>
        )}

        {selectedView === 'indexes' && (
          <Card className="p-4">
            <p className="text-muted-foreground">Index comparison coming soon</p>
          </Card>
        )}

        {selectedView === 'relationships' && (
          <div className="space-y-4">
            {relationshipComparison.length === 0 ? (
              <Card className="p-4">
                <p className="text-muted-foreground">No relationships found in code or database schema.</p>
              </Card>
            ) : (
              relationshipComparison.map((table) => (
                <Card key={table.name} className="p-4">
                  <h3 className="font-semibold mb-4">{table.name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Code Relationships</div>
                      <div className="space-y-1">
                        {table.codeRelationships.length === 0 ? (
                          <div className="text-sm text-muted-foreground">None</div>
                        ) : table.codeRelationships.map((relationship: any) => {
                          const mismatch = filteredMismatches.find(
                            (m) => m.model === table.name && m.field === relationship.column && m.type === 'missing_relationship'
                          );
                          return (
                            <div
                              key={relationshipKey(relationship)}
                              className={`p-2 rounded text-sm ${
                                mismatch ? 'bg-yellow-500/10 border border-yellow-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {mismatch ? (
                                  <Minus className="w-3 h-3 text-yellow-500" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                )}
                                <span className="font-medium">{formatRelationship(table.name, relationship)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Database Relationships</div>
                      <div className="space-y-1">
                        {table.dbRelationships.length === 0 ? (
                          <div className="text-sm text-muted-foreground">None</div>
                        ) : table.dbRelationships.map((relationship: any) => {
                          const mismatch = filteredMismatches.find(
                            (m) => m.model === table.name && m.field === relationship.column && m.type === 'extra_relationship'
                          );
                          return (
                            <div
                              key={relationshipKey(relationship)}
                              className={`p-2 rounded text-sm ${
                                mismatch ? 'bg-yellow-500/10 border border-yellow-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {mismatch ? (
                                  <Plus className="w-3 h-3 text-yellow-500" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                )}
                                <span className="font-medium">{formatRelationship(table.name, relationship)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildTableComparison(codeTables: any[], dbTables: any[], mismatches: any[]) {
  const allTableNames = new Set([
    ...codeTables.map((t: any) => t.name),
    ...dbTables.map((t: any) => t.name),
  ]);

  return Array.from(allTableNames).map((tableName) => {
    const codeTable = codeTables.find((t: any) => t.name === tableName);
    const dbTable = dbTables.find((t: any) => t.name === tableName);

    return {
      name: tableName,
      codeColumns: codeTable?.columns || [],
      dbColumns: dbTable?.columns || [],
    };
  });
}

function buildRelationshipComparison(codeTables: any[], dbTables: any[], mismatches: any[]) {
  const allTableNames = new Set([
    ...codeTables.filter((t: any) => t.relationships?.length).map((t: any) => t.name),
    ...dbTables.filter((t: any) => t.relationships?.length).map((t: any) => t.name),
    ...mismatches.filter((m: any) => m.type === 'missing_relationship' || m.type === 'extra_relationship').map((m: any) => m.model),
  ]);

  return Array.from(allTableNames).map((tableName) => {
    const codeTable = codeTables.find((t: any) => t.name === tableName);
    const dbTable = dbTables.find((t: any) => t.name === tableName);

    return {
      name: tableName,
      codeRelationships: codeTable?.relationships || [],
      dbRelationships: dbTable?.relationships || [],
    };
  });
}

function normalizeTables(tables: any): any[] {
  if (Array.isArray(tables)) {
    return tables.map(normalizeTable).filter(Boolean);
  }

  if (tables && typeof tables === 'object') {
    return Object.entries(tables).map(([name, table]) =>
      normalizeTable({
        name,
        ...(table && typeof table === 'object' ? table : {}),
      })
    );
  }

  return [];
}

function normalizeTable(table: any): any {
  if (!table || typeof table !== 'object') {
    return null;
  }

  return {
    ...table,
    name: table.name,
    columns: normalizeColumns(table.columns),
    relationships: normalizeRelationships(table.relationships),
  };
}

function normalizeRelationships(relationships: any): any[] {
  if (Array.isArray(relationships)) {
    return relationships.map(normalizeRelationship).filter(Boolean);
  }

  return [];
}

function normalizeRelationship(relationship: any): any {
  if (!relationship || typeof relationship !== 'object') {
    return null;
  }

  return {
    ...relationship,
    column: relationship.column || relationship.sourceColumn || relationship.field,
    referencedTable: relationship.referencedTable || relationship.targetTable || relationship.references,
    referencedColumn: relationship.referencedColumn || relationship.targetColumn || 'id',
  };
}

function relationshipKey(relationship: any): string {
  return [
    relationship.column,
    relationship.referencedTable,
    relationship.referencedColumn || 'id',
  ].join(':').toLowerCase();
}

function formatRelationship(tableName: string, relationship: any): string {
  return `${tableName}.${relationship.column} -> ${relationship.referencedTable}.${relationship.referencedColumn || 'id'}`;
}

function normalizeColumns(columns: any): any[] {
  if (Array.isArray(columns)) {
    return columns.map(normalizeColumn).filter(Boolean);
  }

  if (columns && typeof columns === 'object') {
    return Object.entries(columns).map(([name, column]) =>
      normalizeColumn({
        name,
        ...(column && typeof column === 'object' ? column : {}),
      })
    );
  }

  return [];
}

function normalizeColumn(column: any): any {
  if (!column || typeof column !== 'object') {
    return null;
  }

  return {
    ...column,
    name: column.name,
    type: column.type || column.dataType || 'unknown',
  };
}

function normalizeMismatch(mismatch: any): any {
  return {
    ...mismatch,
    model: mismatch.model || mismatch.table || mismatch.tableName,
    field: mismatch.field || mismatch.column || mismatch.columnName,
  };
}

