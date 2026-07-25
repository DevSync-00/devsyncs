import {
  AlertTriangle,
  Check,
  CircleDashed,
  FlaskConical,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

type SafetyReport = {
  score: number;
  decision: 'block' | 'review' | 'ready';
  gates: Array<{
    id: string;
    label: string;
    status: 'passed' | 'failed' | 'required';
    reason: string;
  }>;
  diagnostics: Array<{
    id: string;
    category: string;
    severity: 'blocker' | 'warning' | 'notice';
    object: string;
    title: string;
    evidence: string[];
    remediation: string;
  }>;
};

export default function SafetyGates({ report }: { report: SafetyReport }) {
  const decision = {
    block: {
      title: 'Merge blocked',
      description: 'Resolve compatibility blockers before this change can safely ship.',
      icon: ShieldAlert,
      className: 'border-red-500/30 bg-red-500/10 text-red-500',
    },
    review: {
      title: 'Human review required',
      description: 'The change can proceed after the required evidence and approvals are collected.',
      icon: AlertTriangle,
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    },
    ready: {
      title: 'Ready for review',
      description: 'All automated safety gates passed.',
      icon: ShieldCheck,
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
    },
  }[report.decision];
  const DecisionIcon = decision.icon;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-3 ${decision.className}`}>
            <DecisionIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold">{decision.title}</div>
            <div className="text-sm text-muted-foreground">{decision.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-2">
          <div className="text-3xl font-bold tabular-nums">{report.score}</div>
          <div className="text-xs text-muted-foreground">release<br />readiness</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {report.gates.map((gate) => {
          const state = {
            passed: { icon: Check, label: 'Passed', classes: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
            failed: { icon: LockKeyhole, label: 'Failed', classes: 'text-red-500 bg-red-500/10 border-red-500/20' },
            required: { icon: CircleDashed, label: 'Required', classes: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
          }[gate.status];
          const Icon = gate.id === 'rehearsal' ? FlaskConical : state.icon;
          return (
            <div key={gate.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${state.classes.split(' ')[0]}`} />
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${state.classes}`}>
                  {state.label}
                </span>
              </div>
              <div className="mt-3 text-sm font-medium">{gate.label}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{gate.reason}</div>
            </div>
          );
        })}
      </div>

      {report.diagnostics.length > 0 && (
        <details className="mt-4 rounded-xl border bg-muted/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {report.diagnostics.length} safety finding{report.diagnostics.length === 1 ? '' : 's'} with evidence
          </summary>
          <div className="space-y-3 border-t p-4">
            {report.diagnostics.map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{diagnostic.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{diagnostic.object}</div>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase ${
                    diagnostic.severity === 'blocker'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {diagnostic.severity}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{diagnostic.remediation}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
