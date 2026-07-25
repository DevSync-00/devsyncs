'use client';

import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileCode2,
  GitPullRequest,
  Network,
  Route,
  ShieldCheck,
  TestTube2,
  Users,
  Workflow,
} from 'lucide-react';

type Risk = 'critical' | 'high' | 'medium' | 'low';

type Reference = {
  id: string;
  table: string;
  column?: string;
  file: string;
  line: number;
  kind: string;
  operation: string;
  excerpt: string;
  confidence: number;
};

type Finding = {
  mismatchIndex: number;
  object: string;
  risk: Risk;
  score: number;
  breaking: boolean;
  references: Reference[];
  owners: string[];
  evidence: string[];
  compatibilityPlan: string[];
};

type ImpactReport = {
  version: number;
  generatedAt: string;
  summary: {
    score: number;
    risk: Risk;
    breakingChanges: number;
    affectedFiles: number;
    affectedApis: number;
    affectedJobs: number;
    testCoverageFiles: number;
    ownerCoveragePercent: number;
  };
  findings: Finding[];
  graph: {
    nodes: Array<{ id: string; label: string; type: string; risk?: Risk; metadata?: Record<string, string | number> }>;
    edges: Array<{ id: string; source: string; target: string; label: string }>;
  };
};

const riskStyles: Record<Risk, { text: string; bg: string; border: string; ring: string }> = {
  critical: { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', ring: 'ring-red-500/30' },
  high: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', ring: 'ring-orange-500/30' },
  medium: { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', ring: 'ring-amber-500/30' },
  low: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: 'ring-emerald-500/30' },
};

const nodeIcons: Record<string, typeof Boxes> = {
  database: Boxes,
  schema: FileCode2,
  code: Code2,
  api: Route,
  job: Workflow,
  test: TestTube2,
  owner: Users,
};

export default function ApplicationImpact({ report }: { report: ImpactReport }) {
  const [selectedObject, setSelectedObject] = useState(report.findings[0]?.object || '');
  const [view, setView] = useState<'map' | 'review'>('map');
  const selected = report.findings.find((finding) => finding.object === selectedObject) || report.findings[0];
  const styles = riskStyles[report.summary.risk];

  const visibleReferences = useMemo(() => selected?.references.slice(0, 18) || [], [selected]);
  if (!report?.summary || !report.findings.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="border-b bg-gradient-to-br from-violet-500/10 via-card to-primary/10 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">
              <Network className="h-4 w-4" />
              Application-aware intelligence
            </div>
            <h2 className="text-2xl font-bold">Change impact map</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Trace schema changes through the code, APIs, jobs, tests, and people responsible for them.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border bg-background/70 px-5 py-3 backdrop-blur">
            <div className={`text-4xl font-bold tabular-nums ${styles.text}`}>{report.summary.score}</div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                {report.summary.risk} risk
                {report.summary.breakingChanges > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500">
                    {report.summary.breakingChanges} breaking
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Evidence-based change score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b md:grid-cols-5">
        {[
          ['Affected files', report.summary.affectedFiles],
          ['API surfaces', report.summary.affectedApis],
          ['Background jobs', report.summary.affectedJobs],
          ['Test files', report.summary.testCoverageFiles],
          ['Owner coverage', `${report.summary.ownerCoveragePercent}%`],
        ].map(([label, value]) => (
          <div key={label} className="border-r p-4 last:border-r-0">
            <div className="text-xl font-bold tabular-nums">{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setView('map')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${view === 'map' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            Visual map
          </button>
          <button
            onClick={() => setView('review')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${view === 'review' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            PR review
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {report.graph.nodes.length} nodes · {report.graph.edges.length} connections
        </div>
      </div>

      {view === 'map' ? (
        <div className="grid min-h-[520px] lg:grid-cols-[250px_1fr_340px]">
          <div className="border-r p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Changed objects</div>
            <div className="space-y-2">
              {report.findings.map((finding) => {
                const findingStyle = riskStyles[finding.risk];
                return (
                  <button
                    key={`${finding.mismatchIndex}-${finding.object}`}
                    onClick={() => setSelectedObject(finding.object)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected?.mismatchIndex === finding.mismatchIndex
                        ? `${findingStyle.border} ${findingStyle.bg} ring-1 ${findingStyle.ring}`
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-semibold">{finding.object}</span>
                      <span className={`text-xs font-bold ${findingStyle.text}`}>{finding.score}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="capitalize">{finding.risk}</span>
                      <span>·</span>
                      <span>{finding.references.length} references</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden border-r bg-muted/10 p-6">
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(hsl(var(--muted-foreground)/.25)_1px,transparent_1px)] [background-size:20px_20px]" />
            {selected && (
              <div className="relative mx-auto flex max-w-3xl flex-col items-center">
                <div className={`z-10 rounded-2xl border-2 px-5 py-4 text-center shadow-lg ${riskStyles[selected.risk].border} ${riskStyles[selected.risk].bg}`}>
                  <Boxes className={`mx-auto mb-2 h-6 w-6 ${riskStyles[selected.risk].text}`} />
                  <div className="font-mono text-sm font-bold">{selected.object}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Database object</div>
                </div>
                <div className="h-10 w-px bg-gradient-to-b from-primary to-border" />
                <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
                  {visibleReferences.map((reference) => {
                    const Icon = nodeIcons[reference.kind] || Code2;
                    return (
                      <div key={reference.id} className="group relative rounded-xl border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                        <div className="flex items-start gap-2">
                          <div className="rounded-lg bg-primary/10 p-1.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold" title={reference.file}>{reference.file.split('/').pop()}</div>
                            <div className="mt-0.5 text-[10px] capitalize text-muted-foreground">{reference.kind} · {reference.operation}</div>
                          </div>
                        </div>
                        <div className="mt-2 truncate font-mono text-[9px] text-muted-foreground">
                          L{reference.line}: {reference.excerpt}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!visibleReferences.length && (
                  <div className="rounded-xl border border-dashed bg-card/70 px-8 py-6 text-center">
                    <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
                    <div className="text-sm font-medium">No direct references found</div>
                    <div className="text-xs text-muted-foreground">Check dynamic SQL and external consumers before changing this object.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-5">
            {selected && (
              <div className="space-y-6">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <AlertOctagon className={`h-4 w-4 ${riskStyles[selected.risk].text}`} />
                    Evidence
                  </h3>
                  <div className="mt-3 space-y-2">
                    {selected.evidence.map((item) => (
                      <div key={item} className="flex gap-2 text-xs text-muted-foreground">
                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-violet-500" />
                    Owners
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.owners.length ? selected.owners.map((owner) => (
                      <span key={owner} className="rounded-full border bg-muted px-2.5 py-1 text-[11px]">{owner}</span>
                    )) : <span className="text-xs text-amber-500">No CODEOWNERS match—assign an owner before production.</span>}
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Workflow className="h-4 w-4 text-emerald-500" />
                    Safe compatibility plan
                  </h3>
                  <div className="mt-3 space-y-3">
                    {selected.compatibilityPlan.map((step, index) => (
                      <div key={step} className="flex gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index + 1}</div>
                        <div className="text-xs text-muted-foreground">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl p-6">
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3">
                <GitPullRequest className="h-5 w-5 text-violet-500" />
                <div>
                  <div className="text-sm font-semibold">DevSync database change review</div>
                  <div className="text-xs text-muted-foreground">Automated application compatibility check</div>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles.bg} ${styles.text}`}>
                {report.summary.breakingChanges ? 'Changes requested' : 'Ready for review'}
              </span>
            </div>
            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <ReviewStat label="Risk score" value={`${report.summary.score}/100`} warning={report.summary.score >= 65} />
                <ReviewStat label="Breaking changes" value={String(report.summary.breakingChanges)} warning={report.summary.breakingChanges > 0} />
                <ReviewStat label="Owner coverage" value={`${report.summary.ownerCoveragePercent}%`} warning={report.summary.ownerCoveragePercent < 100} />
              </div>
              <div className="mt-6 space-y-3">
                {report.findings.map((finding) => (
                  <div key={`${finding.mismatchIndex}-${finding.object}`} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {finding.breaking ? <AlertOctagon className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        <span className="font-mono text-sm font-semibold">{finding.object}</span>
                      </div>
                      <span className={`text-xs font-semibold capitalize ${riskStyles[finding.risk].text}`}>{finding.risk}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{finding.references.length} references</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{new Set(finding.references.map((reference) => reference.file)).size} files</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{finding.owners.length ? finding.owners.join(', ') : 'owner required'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewStat({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${warning ? 'text-amber-500' : 'text-emerald-500'}`}>{value}</div>
    </div>
  );
}
