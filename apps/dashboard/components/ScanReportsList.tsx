'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { useToast } from '@/hooks/use-toast';

interface ScanReport {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  mismatches?: any[];
}

interface ScanReportsListProps {
  reports: ScanReport[];
  projectId: string;
}

export default function ScanReportsList({ reports, projectId }: ScanReportsListProps) {
  const [reportList, setReportList] = useState<ScanReport[]>(reports);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setReportList(reports);
  }, [reports]);

  const sortedReports = useMemo(
    () => [...reportList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [reportList]
  );

  useRealtimeTable<ScanReport>({
    table: 'scan_reports',
    filter: `project_id=eq.${projectId}`,
    enabled: Boolean(projectId),
    onInsert: (payload) => {
      if (!payload.new) return;
      const newReport = payload.new as any;
      setReportList((prev) => {
        const exists = prev.some((report) => report.id === newReport?.id);
        return exists ? prev : [newReport as ScanReport, ...prev];
      });
    },
    onUpdate: (payload) => {
      if (!payload.new) return;
      const updatedReport = payload.new as any;
      setReportList((prev) =>
        prev.map((report) => (report.id === updatedReport?.id ? (updatedReport as ScanReport) : report))
      );
    },
    onDelete: (payload) => {
      const deletedReport = payload.old as any;
      if (!deletedReport?.id) return;
      setReportList((prev) => prev.filter((report) => report.id !== deletedReport.id));
    },
    onError: (error) => {
      console.error('Realtime subscription error:', error);
      toast({
        title: 'Connection issue',
        description: 'Lost connection to live updates. Refreshing...',
        variant: 'destructive',
      });
    },
  });

  if (loading && sortedReports.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-card">
        <Loader2 className="w-10 h-10 text-muted-foreground mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold mb-2">Loading scan reports...</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Please wait while we fetch your scan reports.
        </p>
      </div>
    );
  }

  if (sortedReports.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-card">
        <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No scan reports yet</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Trigger a scan from the CLI and keep this page open—we&apos;ll stream results here as soon as they finish.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedReports.map((report) => {
        const mismatchCount = report.mismatches?.length || 0;
        const isComplete = report.status === 'completed';
        const hasMismatches = mismatchCount > 0;

        return (
          <Link
            key={report.id}
            href={`/dashboard/projects/${projectId}/scan-reports/${report.id}`}
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {isComplete ? (
                  hasMismatches ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )
                ) : (
                  <Clock className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <h3 className="font-semibold">
                    Scan Report - {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  isComplete
                    ? hasMismatches
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-green-500/10 text-green-500'
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {report.status}
              </span>
            </div>

            {isComplete && (
              <div className="mt-4">
                {hasMismatches ? (
                  <p className="text-yellow-500 text-sm">
                    ⚠️ Found {mismatchCount} mismatch{mismatchCount !== 1 ? 'es' : ''}
                  </p>
                ) : (
                  <p className="text-green-500 text-sm">
                    ✨ No mismatches found! Everything is in sync.
                  </p>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

