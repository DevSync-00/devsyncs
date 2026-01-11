'use client';

import { useState, useMemo } from 'react';
import ScanReportsList from './ScanReportsList';
import ScanReportFilters, { FilterState } from './ScanReportFilters';
import ExportButton from './ExportButton';

interface ScanReport {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  mismatches?: any[];
}

interface ScanReportsListWithFiltersProps {
  reports: ScanReport[];
  projectId: string;
}

export default function ScanReportsListWithFilters({
  reports,
  projectId,
}: ScanReportsListWithFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: 'all',
    dateRange: 'all',
    status: 'all',
  });

  const filteredReports = useMemo(() => {
    let filtered = [...reports];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter((report) => {
        const searchableText = [
          report.id,
          report.status,
          ...(report.mismatches || []).map((m: any) => `${m.model} ${m.field || ''} ${m.type}`),
        ]
          .join(' ')
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    // Severity filter
    if (filters.severity !== 'all') {
      filtered = filtered.filter((report) => {
        const mismatches = report.mismatches || [];
        return mismatches.some((m: any) => m.severity === filters.severity);
      });
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.created_at);
        return reportDate >= cutoffDate;
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((report) => report.status === filters.status);
    }

    return filtered;
  }, [reports, filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ScanReportFilters onFilterChange={setFilters} />
        <ExportButton
          data={filteredReports}
          filename={`project-${projectId}-scan-reports`}
          exportType="csv"
        />
      </div>
      <ScanReportsList reports={filteredReports} projectId={projectId} />
    </div>
  );
}

