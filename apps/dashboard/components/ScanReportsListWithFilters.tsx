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
      let cutoffDate: Date;
      let upperBoundDate: Date | null = null;
      
      switch (filters.dateRange) {
        case 'today':
          // Both dates derived from the same 'now' moment to avoid midnight boundary issues
          cutoffDate = new Date(now);
          cutoffDate.setHours(0, 0, 0, 0);
          // Upper bound: end of today (start of tomorrow)
          upperBoundDate = new Date(now);
          upperBoundDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          // Properly subtract 7 days using milliseconds to handle month boundaries
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          cutoffDate.setHours(0, 0, 0, 0);
          // Upper bound: end of today
          upperBoundDate = new Date(now);
          upperBoundDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          // Set to first day of previous month to avoid day-of-month edge cases
          // (e.g., March 31 -> February 1 instead of rolling over to March 3)
          cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          cutoffDate.setHours(0, 0, 0, 0);
          // Upper bound: end of previous month (start of current month)
          upperBoundDate = new Date(now.getFullYear(), now.getMonth(), 1);
          upperBoundDate.setHours(0, 0, 0, 0);
          // Subtract 1ms to get the last moment of the previous month
          upperBoundDate = new Date(upperBoundDate.getTime() - 1);
          break;
      }
      
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.created_at);
        if (upperBoundDate) {
          return reportDate >= cutoffDate && reportDate <= upperBoundDate;
        }
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

