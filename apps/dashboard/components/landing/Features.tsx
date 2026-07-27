import { AlertTriangle, ArrowRight, CheckCircle2, FileCode2, GitBranch, GitPullRequest, Layers, ShieldCheck, Terminal } from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="border-b bg-card/40 py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Engineered for Reliability</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need for database change safety.</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Eliminate surprise migrations and schema breakage with continuous automated checks, SQL previews, and dry-run safety rehearsals.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Automated Drift Detection */}
          <div className="rounded-xl border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
            <div>
              <div className="h-10 w-10 rounded-lg border bg-primary/10 flex items-center justify-center text-primary mb-4">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Automated Drift Detection</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Detect schema divergence between code and live databases automatically inside CI/CD pull requests before merging.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-[10px] space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>PR #142 schema-check</span>
                <span className="text-amber-500 font-semibold">• Drift detected</span>
              </div>
              <div className="text-foreground/80">+ 2 column modifications</div>
            </div>
          </div>

          {/* Card 2: SQL Rehearsal Engine */}
          <div className="rounded-xl border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
            <div>
              <div className="h-10 w-10 rounded-lg border bg-primary/10 flex items-center justify-center text-primary mb-4">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Safety & Rehearsal Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Simulate migration execution on temporary shadow databases to estimate lock times and flag destructive DDL operations.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-[10px] space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Lock Estimate</span>
                <span className="text-emerald-500 font-semibold">~240ms (LOW RISK)</span>
              </div>
              <div className="text-foreground/80">0 destructive statements</div>
            </div>
          </div>

          {/* Card 3: Ephemeral Branch Previews */}
          <div className="rounded-xl border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm">
            <div>
              <div className="h-10 w-10 rounded-lg border bg-primary/10 flex items-center justify-center text-primary mb-4">
                <GitBranch className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Ephemeral Branch Previews</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Instant isolated database branching powered by Neon & PostgreSQL for every feature branch and staging preview.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-[10px] flex items-center justify-between">
              <span className="text-muted-foreground">Branch: preview-pr-142</span>
              <span className="text-cyan-500 font-semibold">ACTIVE</span>
            </div>
          </div>

          {/* Card 4: Multi-Environment Promotion Controls (Full Width Banner) */}
          <div className="rounded-xl border bg-card p-6 md:col-span-2 lg:col-span-3 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary/40 transition-colors shadow-sm">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded border bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] text-primary uppercase">
                <ShieldCheck className="h-3.5 w-3.5" /> Promotion Control Plane
              </div>
              <h3 className="font-semibold text-xl">Multi-Environment Promotion Controls</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gate database migrations with multi-stage approval controls (`Dev` → `Staging` → `Prod`), explicit team reviews, and automatic rollback script generation.
              </p>
            </div>
            <div className="w-full md:w-auto flex items-center gap-3 font-mono text-xs">
              <div className="rounded-lg border bg-muted/30 p-3 text-center min-w-28">
                <div className="text-[10px] text-muted-foreground uppercase">Dev</div>
                <div className="text-emerald-500 font-semibold mt-1">Auto-applied</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center min-w-28">
                <div className="text-[10px] text-muted-foreground uppercase">Staging</div>
                <div className="text-amber-500 font-semibold mt-1">Rehearsed</div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="rounded-lg border bg-primary/10 border-primary/30 p-3 text-center min-w-28">
                <div className="text-[10px] text-primary uppercase">Production</div>
                <div className="text-primary font-semibold mt-1">Approval Req</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
