'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export default function PullRequestReviews({ projectId }: { projectId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/pull-request-reviews`)
      .then((response) => response.json())
      .then((body) => {
        setReviews(body.reviews || []);
        setJobs(body.jobs || []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <div className="flex h-24 items-center justify-center rounded-2xl border bg-card"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!reviews.length && !jobs.length) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-6 text-center">
        <GitPullRequest className="mx-auto h-7 w-7 text-muted-foreground" />
        <h2 className="mt-2 text-sm font-semibold">Automated PR reviews are ready</h2>
        <p className="mt-1 text-xs text-muted-foreground">Configure the GitHub App webhook to publish application-aware database checks on every pull request.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5"><GitPullRequest className="h-5 w-5 text-violet-500" /></div>
          <div>
            <h2 className="font-semibold">Pull request safety reviews</h2>
            <p className="text-xs text-muted-foreground">Database compatibility checks published directly to GitHub.</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{reviews.length} recent</span>
      </div>
      <div className="divide-y">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between bg-blue-500/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                {job.status === 'dead'
                  ? <ShieldAlert className="h-4 w-4 text-red-500" />
                  : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              </div>
              <div>
                <div className="text-sm font-semibold">PR #{job.pullNumber} · {job.status.replace('_', ' ')}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {job.headSha?.slice(0, 8)} · attempt {job.attempts}/{job.maxAttempts}
                </div>
                {job.error && <div className="mt-1 max-w-xl truncate text-[10px] text-red-500">{job.error}</div>}
              </div>
            </div>
            <div className="w-32">
              <div className="mb-1 flex justify-between text-[9px] text-muted-foreground">
                <span>{job.progress?.stage || 'queued'}</span><span>{job.progress?.percent || 0}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${job.progress?.percent || 0}%` }} />
              </div>
            </div>
          </div>
        ))}
        {reviews.map((review) => {
          const passed = review.status === 'passed';
          const superseded = review.status === 'superseded';
          const summary = review.summary || {};
          return (
            <div key={review.id} className={`flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between ${superseded ? 'opacity-50' : ''}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={`rounded-lg p-2 ${passed ? 'bg-emerald-500/10' : superseded ? 'bg-muted' : 'bg-red-500/10'}`}>
                  {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                    superseded ? <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" /> :
                      <ShieldAlert className="h-4 w-4 text-red-500" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">PR #{review.pull_request_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                      passed ? 'bg-emerald-500/10 text-emerald-500' :
                        superseded ? 'bg-muted text-muted-foreground' : 'bg-red-500/10 text-red-500'
                    }`}>{review.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{review.repository}</span><span>·</span><span>{review.head_sha.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <Metric label="Risk" value={`${review.risk_score ?? 0}`} warning={(review.risk_score || 0) >= 65} />
                <Metric label="Breaking" value={`${summary.breakingChanges || 0}`} warning={(summary.breakingChanges || 0) > 0} />
                <Metric label="Files" value={`${summary.affectedFiles || 0}`} />
                {review.scan_report_id && (
                  <Link href={`/dashboard/projects/${projectId}/scan-reports/${review.scan_report_id}`} className="rounded-md border p-2 text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-sm font-bold tabular-nums ${warning ? 'text-amber-500' : ''}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
