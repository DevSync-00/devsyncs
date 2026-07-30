'use client';

import React, { useState } from 'react';
import SchemaComparison from './SchemaComparison';
import { SchemaVisualizer } from './erd/SchemaVisualizer';
import { TableProperties, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScanReportVisualizerWrapperProps {
  projectId: string;
  codeSchema: any;
  dbSchema: any;
  mismatches: any[];
}

export default function ScanReportVisualizerWrapper({
  projectId,
  codeSchema,
  dbSchema,
  mismatches,
}: ScanReportVisualizerWrapperProps) {
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('table');

  return (
    <div className="space-y-6">
      {/* View Mode Toggle Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Drift Comparison Studio
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Analyze differences between repository models and live database tables
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 p-0.5 bg-muted/40 border border-border/60 rounded-xl">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="h-8 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <TableProperties className="w-3.5 h-3.5" />
            Comparison Table
          </Button>
          <Button
            variant={viewMode === 'visual' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('visual')}
            className="h-8 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Network className="w-3.5 h-3.5" />
            Visual ER Diagram
          </Button>
        </div>
      </div>

      {/* Renders Selected View */}
      {viewMode === 'table' ? (
        <div className="animate-fade-in">
          <SchemaComparison
            codeSchema={codeSchema}
            dbSchema={dbSchema}
            mismatches={mismatches}
          />
        </div>
      ) : (
        <div className="animate-fade-in">
          <SchemaVisualizer
            projectId={projectId}
            codeSchema={codeSchema}
            dbSchema={dbSchema}
            mismatches={mismatches}
          />
        </div>
      )}
    </div>
  );
}
