import Link from 'next/link';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  if (reports.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg bg-card">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No scan reports yet</h3>
        <p className="text-muted-foreground">
          Run your first scan to see results here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
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

