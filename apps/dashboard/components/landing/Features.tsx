import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="border-b bg-card/30 py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Engineered for Reliability
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Everything you need for database change safety.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Eliminate surprise migrations and schema breakage with continuous automated checks, SQL previews, and dry-run safety rehearsals.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Automated Drift Detection */}
          <div className="rounded-2xl border border-glass bg-card/80 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-lg">
            <div>
              <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-sm">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Automated Drift Detection</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Detect schema divergence between code and live databases automatically inside CI/CD pull requests before merging.
              </p>
            </div>
            <div className="rounded-xl border border-glass bg-muted/40 p-3.5 font-mono text-[10px] space-y-1.5 shadow-inner">
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="font-medium text-foreground">PR #142 schema-check</span>
                <span className="text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" /> • Drift detected
                </span>
              </div>
              <div className="text-foreground/80 font-mono">+ 2 column modifications</div>
            </div>
          </div>

          {/* Card 2: SQL Rehearsal Engine */}
          <div className="rounded-2xl border border-glass bg-card/80 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-lg">
            <div>
              <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Safety & Rehearsal Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Simulate migration execution on temporary shadow databases to estimate lock times and flag destructive DDL operations.
              </p>
            </div>
            <div className="rounded-xl border border-glass bg-muted/40 p-3.5 font-mono text-[10px] space-y-1.5 shadow-inner">
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="font-medium text-foreground">Lock Estimate</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">~240ms (LOW RISK)</span>
              </div>
              <div className="text-foreground/80 font-mono">0 destructive statements</div>
            </div>
          </div>

          {/* Card 3: Ephemeral Branch Previews */}
          <div className="rounded-2xl border border-glass bg-card/80 backdrop-blur-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-lg">
            <div>
              <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-sm">
                <GitBranch className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">Ephemeral Branch Previews</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Instant isolated database branching powered by Neon & PostgreSQL for every feature branch and staging preview.
              </p>
            </div>
            <div className="rounded-xl border border-glass bg-muted/40 p-3.5 font-mono text-[10px] flex items-center justify-between shadow-inner">
              <span className="text-muted-foreground font-medium">Branch: preview-pr-142</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> ACTIVE
              </span>
            </div>
          </div>

          {/* Card 4: Multi-Environment Promotion Controls (Full Width Banner) */}
          <div className="rounded-2xl border border-glass bg-gradient-to-r from-card via-card to-primary/5 p-6 sm:p-8 md:col-span-2 lg:col-span-3 flex flex-col lg:flex-row items-center justify-between gap-8 hover:border-primary/50 transition-all shadow-xl backdrop-blur-xl">
            {/* Left Description Column */}
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] font-semibold text-primary uppercase tracking-wider shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" /> Promotion Control Plane
              </div>
              <h3 className="font-semibold text-xl sm:text-2xl text-foreground">Multi-Environment Promotion Controls</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Gate database migrations with multi-stage approval controls (<code className="text-foreground bg-muted/50 px-1 rounded">Dev</code> → <code className="text-foreground bg-muted/50 px-1 rounded">Staging</code> → <code className="text-foreground bg-muted/50 px-1 rounded">Prod</code>), explicit team reviews, and automatic rollback script generation.
              </p>
            </div>

            {/* Right Multi-Stage Pipeline Visualizer Flow */}
            <div className="w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
              <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs min-w-[560px] justify-center">
                {/* Stage 1: DEV */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-4 flex-1 min-w-[160px] space-y-1.5 shadow-md">
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider">
                    <span>DEV</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Auto-Applied</div>
                  <div className="text-[9px] text-emerald-700/80 dark:text-emerald-300/80">0s lock · Migration sync</div>
                </div>

                {/* Connecting Arrow 1 */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 text-emerald-500 animate-pulse" />
                </div>

                {/* Stage 2: STAGING */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 p-4 flex-1 min-w-[160px] space-y-1.5 shadow-md">
                  <div className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider">
                    <span>STAGING</span>
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Rehearsed</div>
                  <div className="text-[9px] text-amber-700/80 dark:text-amber-300/80">~180ms lock · Verified</div>
                </div>

                {/* Connecting Arrow 2 */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 text-amber-500 animate-pulse" />
                </div>

                {/* Stage 3: PRODUCTION */}
                <div className="rounded-xl border border-primary/40 bg-primary/15 p-4 flex-1 min-w-[170px] space-y-1.5 shadow-lg shadow-primary/10 ring-1 ring-primary/30">
                  <div className="flex items-center justify-between text-[10px] text-primary font-bold uppercase tracking-wider">
                    <span>PRODUCTION</span>
                    <LockKeyhole className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-primary">Approval Required</div>
                  <div className="text-[9px] text-primary/80">Preflight Gate · Audit Logged</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
