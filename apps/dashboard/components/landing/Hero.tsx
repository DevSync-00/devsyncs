"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  Terminal,
  Settings,
  ShieldAlert,
  Sparkles
} from "lucide-react";

type CliCommand = "scan" | "status" | "fix" | "apply";

const Hero = () => {
  const [activeCmd, setActiveCmd] = useState<CliCommand>("scan");

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden gradient-hero pt-28 pb-20">
      <div className="absolute inset-0 mesh-grid pointer-events-none" />
      <div className="absolute inset-0 noise-overlay pointer-events-none opacity-60" />

      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] animate-float-delayed" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm font-medium text-primary">
              Database-first schema sync
            </span>
          </div>

          <h1 className="animate-fade-in-up-delay-1 font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight mb-6">
            Catch schema drift{" "}
            <span className="text-gradient">before it ships</span>
          </h1>

          <p className="animate-fade-in-up-delay-2 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            DevSync scans your codebase and database, surfaces mismatches with
            context, and generates reviewable fixes — across CLI, VS Code, and
            your team dashboard.
          </p>

          <div className="animate-fade-in-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="group h-14 px-8 text-base font-semibold gradient-primary text-primary-foreground border-0 hover:opacity-90 glow-primary"
              >
                Start free
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base border-border/80 bg-card/30 hover:bg-card/60 backdrop-blur-sm"
              >
                <BookOpen className="mr-2 w-5 h-5" />
                Read the docs
              </Button>
            </Link>
          </div>

          <p className="animate-fade-in-up-delay-3 text-sm text-muted-foreground">
            Read-only scan by default · Apply requires explicit approval
          </p>
        </div>

        {/* Product preview */}
        <div className="animate-fade-in-up-delay-4 mt-16 md:mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-white/10 glass-strong shadow-elevated overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            {/* Terminal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-secondary/30">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-3 text-xs font-mono text-muted-foreground">
                  devsync — cli_console
                </span>
              </div>
              {/* Command Selectors */}
              <div className="flex items-center gap-1.5 bg-background/50 p-1 rounded-lg border border-border/40">
                {(["scan", "status", "fix", "apply"] as CliCommand[]).map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => setActiveCmd(cmd)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                      activeCmd === cmd
                        ? "bg-primary text-primary-foreground font-semibold shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Grid */}
            <div className="grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border/60 min-h-[250px]">
              
              {/* Terminal Left Pane: CLI Shell */}
              <div className="md:col-span-3 p-5 font-mono text-xs sm:text-sm space-y-3 bg-background/40 select-none">
                {activeCmd === "scan" && (
                  <>
                    <div className="text-muted-foreground">
                      <span className="text-primary">$</span> devsync scan --path ./my-app
                    </div>
                    <div className="text-muted-foreground pl-2 text-xs">
                      → Project: my-saas-api (ID: 8fa2b1)
                    </div>
                    <div className="text-muted-foreground pl-2 text-xs">
                      → Schema: Prisma · DB: PostgreSQL
                    </div>
                    <div className="pl-2 text-sky-400 text-xs">
                      ℹ️ Connecting to DB: postgresql://***@localhost:5432/main
                    </div>
                    <div className="pl-2 flex items-start gap-2 text-amber-400/90">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>2 mismatches detected</span>
                    </div>
                    <div className="pl-6 space-y-1 text-muted-foreground text-xs border-l border-amber-500/30 ml-2">
                      <div><span className="text-red-400">🔴 Error:</span> Table "Profile" is missing in database</div>
                      <div><span className="text-yellow-400">⚠️ Warning:</span> Field "publishedAt" in model "Post" has type mismatch (Code: DateTime, DB: VARCHAR)</div>
                    </div>
                    <div className="pl-2 flex items-center gap-2 text-emerald-400/90">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Read-only scan complete — awaiting fix preview</span>
                    </div>
                  </>
                )}

                {activeCmd === "status" && (
                  <>
                    <div className="text-muted-foreground">
                      <span className="text-primary">$</span> devsync status --path ./my-app
                    </div>
                    <div className="pl-2 space-y-1 text-xs">
                      <div className="text-yellow-500 font-bold">STATUS: DRIFT_DETECTED (2 mismatches found)</div>
                      <div className="text-muted-foreground">Code Schema Hash: <span className="text-foreground">a89d2f3c</span></div>
                      <div className="text-muted-foreground">Live Database Hash: <span className="text-foreground">e12b40aa</span></div>
                      <div className="text-muted-foreground">Last Scan: 2 minutes ago</div>
                    </div>
                    <div className="pl-2 text-muted-foreground text-xs pt-2">
                      Run <code className="bg-muted px-1.5 py-0.5 rounded text-primary">devsync fix</code> to generate a previewable migration.
                    </div>
                  </>
                )}

                {activeCmd === "fix" && (
                  <>
                    <div className="text-muted-foreground">
                      <span className="text-primary">$</span> devsync fix --path ./my-app
                    </div>
                    <div className="pl-2 text-muted-foreground text-xs">
                      🤖 Proposing AI-generated fixes for 2 conflicts...
                    </div>
                    <div className="pl-4 space-y-2 border-l border-primary/30 ml-2 text-xs">
                      <div>
                        <span className="text-primary font-semibold">{"// Fix 1: Create missing Profiles table"}</span>
                        <pre className="text-[10px] text-muted-foreground mt-1 bg-black/25 p-2 rounded border border-border/20 font-mono">
{`CREATE TABLE "profiles" (
  "id" SERIAL PRIMARY KEY,
  "bio" TEXT,
  "userId" INTEGER NOT NULL
);`}
                        </pre>
                      </div>
                      <div>
                        <span className="text-primary font-semibold">{"// Fix 2: Cast VARCHAR back to TIMESTAMP"}</span>
                        <pre className="text-[10px] text-muted-foreground mt-1 bg-black/25 p-2 rounded border border-border/20 font-mono">
{`ALTER TABLE "posts" 
ALTER COLUMN "publishedAt" TYPE TIMESTAMP 
USING "publishedAt"::timestamp;`}
                        </pre>
                      </div>
                    </div>
                    <div className="pl-2 text-emerald-400 text-xs">
                      ✔ Saved preview SQL to: <span className="underline">./migrations/20260716_fix_drift.sql</span>
                    </div>
                    <div className="pl-2 text-sky-400 text-xs font-semibold">
                      💡 AI Safety Score: 92/100 (Safe to apply, rollback script included)
                    </div>
                  </>
                )}

                {activeCmd === "apply" && (
                  <>
                    <div className="text-muted-foreground">
                      <span className="text-primary">$</span> devsync apply --path ./my-app
                    </div>
                    <div className="pl-2 flex items-start gap-2 text-red-500 text-xs">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <div>
                        <span className="font-bold">BLOCKED: Destructive / write operations are read-only by default.</span>
                        <div className="text-muted-foreground mt-1">
                          To apply these changes, you must either:
                          <ol className="list-decimal pl-4 mt-1 space-y-1">
                            <li>Run the command with explicit flag: <code className="bg-muted px-1 py-0.5 rounded text-red-400 font-bold">devsync apply --confirm</code></li>
                            <li>Confirm and trigger execution visually via your Web Dashboard.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Terminal Right Pane: GUI Sync Center Info */}
              <div className="md:col-span-2 p-5 space-y-4 bg-card/10 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Interactive Specs
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize font-mono">
                    {activeCmd} phase
                  </span>
                </div>

                {activeCmd === "scan" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-muted-foreground">
                      Scans DB connection strings, Docker, Prisma, ORMs, and raw SQL schemas to map canonical models.
                    </p>
                    <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-muted-foreground font-mono text-[10px] space-y-1">
                      <div className="flex justify-between"><span>Models Scanned:</span> <span className="text-foreground">24</span></div>
                      <div className="flex justify-between"><span>Tables in DB:</span> <span className="text-foreground">22</span></div>
                    </div>
                  </div>
                )}

                {activeCmd === "status" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-muted-foreground">
                      Calculates cryptographic schema checksums to instantly determine if live DB diverges from code changes.
                    </p>
                    <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-muted-foreground font-mono text-[10px]">
                      <div className="text-yellow-500 font-medium">⚠️ Drift Detected</div>
                      <div className="mt-1">Changes are review-locked.</div>
                    </div>
                  </div>
                )}

                {activeCmd === "fix" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-muted-foreground">
                      AI analyzes conflicts and designs safe DDL statements and corresponding rollback scripts.
                    </p>
                    <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-muted-foreground font-mono text-[10px] space-y-1">
                      <div className="flex justify-between"><span>Safety Index:</span> <span className="text-emerald-500">92%</span></div>
                      <div className="flex justify-between"><span>Downtime:</span> <span className="text-foreground">0ms</span></div>
                    </div>
                  </div>
                )}

                {activeCmd === "apply" && (
                  <div className="space-y-3 text-xs">
                    <p className="text-muted-foreground text-red-500/80 dark:text-red-400/90 font-medium">
                      🔒 Safety First Principle
                    </p>
                    <p className="text-muted-foreground">
                      Destructive actions are sandboxed. Users must explicitly authorize writes to live databases.
                    </p>
                  </div>
                )}

                <div className="space-y-2 border-t border-border/40 pt-4">
                  {[
                    "Staggered DDL Analysis",
                    "Safety Score Evaluation",
                    "Rollback Scripting"
                  ].map((step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-2.5 text-xs text-muted-foreground"
                    >
                      <span className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute left-0 right-0 top-[45%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-shimmer pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
