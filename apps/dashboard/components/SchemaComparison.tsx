'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Edit, AlertCircle, CheckCircle2, Database, Code, Info } from 'lucide-react';

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
  const indexComparison = buildIndexComparison(codeTables, dbTables, filteredMismatches);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Schema Comparison
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Compare canonical code representation against live database definitions
          </p>
        </div>
        
        {/* Severity Filters */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/40 self-start sm:self-auto">
          {(['all', 'error', 'warning', 'info'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs capitalize px-3"
              onClick={() => setFilterType(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Tabs navigation */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-px">
          {(['tables', 'columns', 'indexes', 'relationships'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all capitalize -mb-px ${
                selectedView === view
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* 1. Tables View */}
        {selectedView === 'tables' && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Code side */}
              <Card className="p-5 glass-strong border-border/60">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" />
                  Code Schema
                </h3>
                <div className="space-y-2">
                  {codeTables.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">No tables declared in code.</div>
                  ) : codeTables.map((table: any) => {
                    const mismatch = filteredMismatches.find(
                      (m) => m.model === table.name && m.type === 'missing_table'
                    );
                    return (
                      <div
                        key={table.name}
                        className={`p-3 rounded-xl border transition-all ${
                          mismatch 
                            ? 'border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300' 
                            : 'border-border/60 bg-card/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {mismatch ? (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                            <span className="font-semibold text-sm">{table.name}</span>
                          </div>
                          {mismatch && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-red-500/15 border border-red-500/20 rounded-full font-semibold">
                              missing in db
                            </span>
                          )}
                        </div>
                        {table.columns && (
                          <div className="text-xs text-muted-foreground mt-1.5 pl-6">
                            {table.columns.length} columns declared
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Database side */}
              <Card className="p-5 glass-strong border-border/60">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4 text-accent" />
                  Database Schema
                </h3>
                <div className="space-y-2">
                  {dbTables.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">No tables found in live database.</div>
                  ) : dbTables.map((table: any) => {
                    const mismatch = filteredMismatches.find(
                      (m) => m.model === table.name && m.type === 'extra_table'
                    );
                    return (
                      <div
                        key={table.name}
                        className={`p-3 rounded-xl border transition-all ${
                          mismatch 
                            ? 'border-green-500/30 bg-green-500/5 text-green-800 dark:text-green-300' 
                            : 'border-border/60 bg-card/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {mismatch ? (
                              <AlertCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                            <span className="font-semibold text-sm">{table.name}</span>
                          </div>
                          {mismatch && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-green-500/15 border border-green-500/20 rounded-full font-semibold">
                              extra in db
                            </span>
                          )}
                        </div>
                        {table.columns && (
                          <div className="text-xs text-muted-foreground mt-1.5 pl-6">
                            {table.columns.length} columns active
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

        {/* 2. Columns View */}
        {selectedView === 'columns' && (
          <div className="space-y-6 animate-fade-in-up">
            {tableComparison.map((table) => {
              const tableHasMismatches = filteredMismatches.some(m => m.model === table.name);
              
              return (
                <Card key={table.name} className="p-5 border-border/60 glass-strong">
                  <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                    <h3 className="font-bold text-base text-foreground">{table.name}</h3>
                    {tableHasMismatches && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Drift detected inside columns
                      </span>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Code columns */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Code Columns</div>
                      <div className="space-y-2">
                        {table.codeColumns.length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">None</div>
                        ) : table.codeColumns.map((col: any) => {
                          const mismatch = filteredMismatches.find(
                            (m) => m.model === table.name && m.field === col.name
                          );
                          const isMissing = mismatch && mismatch.type === 'missing_field';
                          const isTypeMismatch = mismatch && mismatch.type === 'type_mismatch';
                          
                          return (
                            <div
                              key={col.name}
                              className={`p-2.5 rounded-xl border text-sm transition-all ${
                                isMissing 
                                  ? 'bg-red-500/5 border-red-500/30 text-red-800 dark:text-red-300' 
                                  : isTypeMismatch 
                                  ? 'bg-yellow-500/5 border-yellow-500/30 text-yellow-800 dark:text-yellow-300'
                                  : 'bg-muted/40 border-border/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {mismatch ? (
                                    <Minus className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  )}
                                  <span className="font-semibold text-xs font-mono">{col.name}</span>
                                </div>
                                <span className="text-[10px] font-mono bg-background/50 border border-border/20 px-2 py-0.5 rounded text-muted-foreground">
                                  {col.type}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Database columns */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Database Columns</div>
                      <div className="space-y-2">
                        {table.dbColumns.length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">None</div>
                        ) : table.dbColumns.map((col: any) => {
                          const mismatch = filteredMismatches.find(
                            (m) => m.model === table.name && m.field === col.name
                          );
                          const isExtra = mismatch && mismatch.type === 'extra_field';
                          const isTypeMismatch = mismatch && mismatch.type === 'type_mismatch';
                          
                          return (
                            <div
                              key={col.name}
                              className={`p-2.5 rounded-xl border text-sm transition-all ${
                                isExtra 
                                  ? 'bg-green-500/5 border-green-500/30 text-green-800 dark:text-green-300' 
                                  : isTypeMismatch 
                                  ? 'bg-yellow-500/5 border-yellow-500/30 text-yellow-800 dark:text-yellow-300'
                                  : 'bg-muted/40 border-border/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {mismatch ? (
                                    <Plus className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  )}
                                  <span className="font-semibold text-xs font-mono">{col.name}</span>
                                </div>
                                <span className="text-[10px] font-mono bg-background/50 border border-border/20 px-2 py-0.5 rounded text-muted-foreground">
                                  {col.type}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 3. Indexes View */}
        {selectedView === 'indexes' && (
          <div className="space-y-6 animate-fade-in-up">
            {indexComparison.length === 0 ? (
              <Card className="p-5 border-border/60 text-center text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No indexes found in code or database schema.</p>
              </Card>
            ) : (
              indexComparison.map((table) => {
                const tableHasIndexMismatches = filteredMismatches.some(
                  m => m.model === table.name && (m.type === 'missing_index' || m.type === 'extra_index')
                );
                
                return (
                  <Card key={table.name} className="p-5 border-border/60 glass-strong">
                    <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                      <h3 className="font-bold text-base text-foreground">{table.name}</h3>
                      {tableHasIndexMismatches && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Index mismatch detected
                        </span>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Code indexes */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Code Indexes</div>
                        <div className="space-y-2">
                          {table.codeIndexes.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-lg p-4 bg-muted/10">None declared</div>
                          ) : table.codeIndexes.map((idx: any) => {
                            const mismatch = filteredMismatches.find(
                              (m) => m.model === table.name && m.field === idx.name && m.type === 'missing_index'
                            );
                            return (
                              <div
                                key={idx.name}
                                className={`p-2.5 rounded-xl border text-sm transition-all ${
                                  mismatch 
                                    ? 'bg-red-500/5 border-red-500/30 text-red-800 dark:text-red-300' 
                                    : 'bg-muted/40 border-border/40'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    {mismatch ? (
                                      <Minus className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    )}
                                    <span className="font-mono text-xs font-semibold break-all">{idx.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] bg-background/50 border border-border/20 px-2 py-0.5 rounded text-muted-foreground font-mono">
                                      {idx.columns?.join(', ')}
                                    </span>
                                    {idx.unique && (
                                      <span className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold font-mono">
                                        unique
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Database indexes */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Database Indexes</div>
                        <div className="space-y-2">
                          {table.dbIndexes.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-lg p-4 bg-muted/10">None found</div>
                          ) : table.dbIndexes.map((idx: any) => {
                            const mismatch = filteredMismatches.find(
                              (m) => m.model === table.name && m.field === idx.name && m.type === 'extra_index'
                            );
                            return (
                              <div
                                key={idx.name}
                                className={`p-2.5 rounded-xl border text-sm transition-all ${
                                  mismatch 
                                    ? 'bg-green-500/5 border-green-500/30 text-green-800 dark:text-green-300' 
                                    : 'bg-muted/40 border-border/40'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    {mismatch ? (
                                      <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                    )}
                                    <span className="font-mono text-xs font-semibold break-all">{idx.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] bg-background/50 border border-border/20 px-2 py-0.5 rounded text-muted-foreground font-mono">
                                      {idx.columns?.join(', ')}
                                    </span>
                                    {idx.unique && (
                                      <span className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold font-mono">
                                        unique
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* 4. Relationships View */}
        {selectedView === 'relationships' && (
          <div className="space-y-6 animate-fade-in-up">
            {relationshipComparison.length === 0 ? (
              <Card className="p-5 border-border/60 text-center text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No relationships found in code or database schema.</p>
              </Card>
            ) : (
              relationshipComparison.map((table) => {
                const tableHasRelationMismatches = filteredMismatches.some(
                  m => m.model === table.name && (m.type === 'missing_relationship' || m.type === 'extra_relationship')
                );
                
                return (
                  <Card key={table.name} className="p-5 border-border/60 glass-strong">
                    <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                      <h3 className="font-bold text-base text-foreground">{table.name}</h3>
                      {tableHasRelationMismatches && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Relation mismatch detected
                        </span>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Code relationships */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Code Relationships</div>
                        <div className="space-y-2">
                          {table.codeRelationships.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-lg p-4 bg-muted/10">None declared</div>
                          ) : table.codeRelationships.map((relationship: any) => {
                            const mismatch = filteredMismatches.find(
                              (m) => m.model === table.name && m.field === relationship.column && m.type === 'missing_relationship'
                            );
                            return (
                              <div
                                key={relationshipKey(relationship)}
                                className={`p-2.5 rounded-xl border text-sm transition-all ${
                                  mismatch 
                                    ? 'bg-red-500/5 border-red-500/30 text-red-800 dark:text-red-300' 
                                    : 'bg-muted/40 border-border/40'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {mismatch ? (
                                    <Minus className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  )}
                                  <span className="font-medium text-xs font-mono break-all">{formatRelationship(table.name, relationship)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Database relationships */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Database Relationships</div>
                        <div className="space-y-2">
                          {table.dbRelationships.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-lg p-4 bg-muted/10">None found</div>
                          ) : table.dbRelationships.map((relationship: any) => {
                            const mismatch = filteredMismatches.find(
                              (m) => m.model === table.name && m.field === relationship.column && m.type === 'extra_relationship'
                            );
                            return (
                              <div
                                key={relationshipKey(relationship)}
                                className={`p-2.5 rounded-xl border text-sm transition-all ${
                                  mismatch 
                                    ? 'bg-green-500/5 border-green-500/30 text-green-800 dark:text-green-300' 
                                    : 'bg-muted/40 border-border/40'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {mismatch ? (
                                    <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  )}
                                  <span className="font-medium text-xs font-mono break-all">{formatRelationship(table.name, relationship)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
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

function buildIndexComparison(codeTables: any[], dbTables: any[], mismatches: any[]) {
  const allTableNames = new Set([
    ...codeTables.filter((t: any) => t.indexes?.length).map((t: any) => t.name),
    ...dbTables.filter((t: any) => t.indexes?.length).map((t: any) => t.name),
    ...mismatches.filter((m: any) => m.type === 'missing_index' || m.type === 'extra_index').map((m: any) => m.model),
  ]);

  return Array.from(allTableNames).map((tableName) => {
    const codeTable = codeTables.find((t: any) => t.name === tableName);
    const dbTable = dbTables.find((t: any) => t.name === tableName);

    return {
      name: tableName,
      codeIndexes: codeTable?.indexes || [],
      dbIndexes: dbTable?.indexes || [],
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
    indexes: normalizeIndexes(table.indexes),
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
  return `${tableName}.${relationship.column} ➔ ${relationship.referencedTable}.${relationship.referencedColumn || 'id'}`;
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

function normalizeIndexes(indexes: any): any[] {
  if (Array.isArray(indexes)) {
    return indexes.map(normalizeIndex).filter(Boolean);
  }
  return [];
}

function normalizeIndex(index: any): any {
  if (!index || typeof index !== 'object') {
    return null;
  }
  return {
    name: index.name,
    columns: Array.isArray(index.columns) ? index.columns : [],
    unique: !!index.unique,
  };
}

function normalizeMismatch(mismatch: any): any {
  return {
    ...mismatch,
    model: mismatch.model || mismatch.table || mismatch.tableName,
    field: mismatch.field || mismatch.column || mismatch.columnName,
  };
}
