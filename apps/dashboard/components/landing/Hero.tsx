"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Database,
  GitBranch,
  Play,
  Pause,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Code2,
  Network,
  Files,
  Search,
  Settings,
  RefreshCw,
  Zap,
  Key,
  Layers,
  MousePointer,
} from "lucide-react";
import Logo from "@/components/Logo";

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const [surfaceIndex, setSurfaceIndex] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);

  // CLI Typewriter state
  const fullCliCommand = "npx dev-sync scan --check --schema ./prisma/schema.prisma";
  const [typedCliText, setTypedCliText] = useState("");
  const [cliLogsVisible, setCliLogsVisible] = useState(false);

  // VS Code quick fix simulation state
  const [vscodeFixed, setVscodeFixed] = useState(false);
  const [vscodeFixing, setVscodeFixing] = useState(false);

  const command = "npx dev-sync scan";

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const surfaces = [
    { id: "cli", label: "CLI Tool", icon: Terminal, badge: "Typewriter CLI" },
    { id: "vscode", label: "VS Code Extension", icon: Code2, badge: "Sidebar IDE" },
    { id: "erd", label: "Database Visualizer (ERD)", icon: Network, badge: "Hierarchical SVG" },
  ];

  // 5-Second Automated Timeframe Surface Swapping Interval
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setSurfaceIndex((prevIndex) => (prevIndex + 1) % surfaces.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay, surfaces.length]);

  // CLI Typewriter effect loop when surface 0 (CLI) is active
  useEffect(() => {
    if (surfaceIndex !== 0) return;

    let charIndex = 0;
    setTypedCliText("");
    setCliLogsVisible(false);

    const typeInterval = setInterval(() => {
      if (charIndex <= fullCliCommand.length) {
        setTypedCliText(fullCliCommand.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => setCliLogsVisible(true), 250);
      }
    }, 40);

    return () => clearInterval(typeInterval);
  }, [surfaceIndex]);

  const handleManualSurfaceSelect = (idx: number) => {
    setAutoPlay(false); // Pause auto-play when user clicks manually
    setSurfaceIndex(idx);
  };

  const handleApplyVscodeFix = () => {
    setVscodeFixing(true);
    setTimeout(() => {
      setVscodeFixing(false);
      setVscodeFixed(true);
    }, 800);
  };

  return (
    <section id="product" className="relative overflow-hidden border-b pt-24 bg-ambient-glow">
      <div className="relative mx-auto grid min-h-[760px] max-w-[1400px] items-center gap-8 lg:gap-12 px-4 py-16 sm:px-6 lg:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:py-24">
        {/* Hero Left Content Column */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Database change control for engineering teams
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.12] sm:leading-[1.08] tracking-[-0.03em] text-foreground">
            Continuous Database Integration & Drift Prevention.
          </h1>
          <p className="text-sm sm:text-base leading-6 sm:leading-7 text-muted-foreground max-w-xl">
            Detect schema divergence in pull requests, review exact SQL diffs, and ship zero-downtime database changes across every environment.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <Link
              href="/auth/signup"
              className="inline-flex h-11 sm:h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-5 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Start scanning free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 sm:h-10 w-full sm:w-auto items-center justify-center rounded-lg border border-glass bg-card px-4 font-mono text-xs text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              Read quickstart
            </Link>
          </div>

          {/* Quickstart CLI Installer Command Widget */}
          <button
            type="button"
            onClick={copy}
            className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-glass bg-card/80 backdrop-blur-md px-3.5 py-2.5 text-left font-mono text-xs text-foreground hover:border-primary/40 transition-colors shadow-sm group"
          >
            <span className="text-primary font-bold">$</span>
            <span className="flex-1 font-medium">{command}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
            ) : (
              <Clipboard className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>

          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] text-muted-foreground pt-1">
            <span>✓ Read-only by default</span>
            <span>✓ No credit card</span>
            <span>✓ Postgres & Supabase ready</span>
          </div>
        </div>

        {/* Hero Right Column: Automated Timeframe Surface-Swapping Studio Window */}
        <div className="overflow-hidden rounded-2xl border border-glass bg-card/95 shadow-2xl backdrop-blur-2xl transition-all">
          {/* Surface Selector Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3 text-muted-foreground text-[11px] gap-2 font-mono">
            {/* Surface Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
              {surfaces.map((surf, idx) => {
                const Icon = surf.icon;
                const active = surfaceIndex === idx;
                return (
                  <button
                    key={surf.id}
                    type="button"
                    onClick={() => handleManualSurfaceSelect(idx)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-md"
                        : "border border-glass bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/90"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="inline whitespace-nowrap">{surf.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Auto-Play Control & Live Stage Counter */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoPlay((prev) => !prev)}
                className="flex items-center gap-1.5 rounded border border-glass bg-card px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors text-[10px] whitespace-nowrap"
                title={autoPlay ? "Pause automated surface swapping" : "Resume automated surface swapping"}
              >
                {autoPlay ? (
                  <>
                    <Pause className="h-3 w-3 text-amber-400" />
                    <span>Auto-Swap (5s)</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 text-emerald-400" />
                    <span>Auto-Swap OFF</span>
                  </>
                )}
              </button>

              {autoPlay && (
                <span className="flex items-center gap-1 text-[10px] text-primary font-semibold whitespace-nowrap">
                  <Sparkles className="h-3 w-3 animate-spin" /> Stage {surfaceIndex + 1}/3
                </span>
              )}
            </div>
          </div>

          {/* DYNAMIC SURFACE WORKFLOW CONTAINERS */}
          <div className="transition-all duration-300 overflow-x-auto touch-pan-x">
            {/* SURFACE 1: CLI TOOL WORKFLOW */}
            {surfaceIndex === 0 && (
              <div className="font-mono text-xs animate-in fade-in zoom-in-95 duration-300 min-w-[540px]">
                {/* Terminal Title Bar */}
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2.5 text-muted-foreground text-[11px]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                      <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                      <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="ml-2 font-semibold text-foreground/80">zsh — dev-sync scan</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">dev-sync CLI v0.2.0</span>
                </div>

                {/* Terminal Body */}
                <div className="p-6 space-y-4 text-foreground/90 leading-6 bg-card/60 min-h-[380px]">
                  {/* Typewriter Prompt */}
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <span>~/projects/acme-app (main) $</span>
                    <span className="text-foreground font-normal">{typedCliText}</span>
                    <span className="h-4 w-1.5 bg-primary animate-pulse inline-block" />
                  </div>

                  {/* Streamed Output Logs */}
                  {cliLogsVisible ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <div>[11:42:01] <span className="text-cyan-400 font-semibold">INFO</span> Parsing schema definition: <code className="text-foreground">./prisma/schema.prisma</code></div>
                        <div>[11:42:02] <span className="text-cyan-400 font-semibold">INFO</span> Connected to target database: <code className="text-foreground">postgres://user:***@aws-db.neon.tech:5432/main</code></div>
                        <div>[11:42:02] <span className="text-amber-400 font-semibold">WARN</span> Schema drift detected across 2 tables:</div>
                      </div>

                      {/* ASCII Table Diff */}
                      <div className="overflow-x-auto rounded-lg border border-glass bg-muted/30 p-3 text-[10px] text-foreground font-mono leading-5 shadow-inner">
                        <div className="text-muted-foreground font-semibold pb-1 border-b border-border/40 grid grid-cols-4 gap-2">
                          <span>TABLE</span><span>COLUMN</span><span>CODE (PRISMA)</span><span>DATABASE (LIVE)</span>
                        </div>
                        <div className="pt-1.5 space-y-1">
                          <div className="grid grid-cols-4 gap-2 text-amber-400 font-medium">
                            <span>posts</span><span>published_at</span><span>DateTime?</span><span>VARCHAR(255)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-rose-400 font-medium">
                            <span>posts</span><span>author_id</span><span>Int (Required)</span><span>[MISSING]</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-emerald-400">
                            <span>profiles</span><span>bio</span><span>Text?</span><span>Text (Synced)</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="text-emerald-400 font-semibold">✔ PASS Safety Rehearsal: 0 destructive operations, lock estimate ~240ms</div>
                        <div className="text-emerald-400 font-semibold">✔ PASS Auto-generated rollback plan saved: <code className="text-foreground">./migrations/20260728_rollback.sql</code></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground/60 text-[11px] font-mono italic pt-2">
                      typing command...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SURFACE 2: VS CODE EXTENSION WORKFLOW */}
            {surfaceIndex === 1 && (
              <div className="font-mono text-xs animate-in fade-in zoom-in-95 duration-300 min-w-[640px]">
                {/* Mobile Scroll Hint Banner */}
                <div className="sm:hidden bg-primary/10 border-b border-primary/20 px-4 py-1 text-[10px] text-primary flex items-center justify-between font-mono">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ArrowRight className="h-3 w-3 animate-pulse" /> Swipe right to view full 3-pane IDE & Editor
                  </span>
                  <span className="text-[9px] opacity-80">Full View</span>
                </div>

                {/* VS Code Window Header */}
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5 text-muted-foreground text-[11px]">
                  <div className="flex items-center gap-3">
                    <Code2 className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-foreground">schema.prisma — Acme API — Visual Studio Code</span>
                  </div>
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400 font-medium">DevSync Extension Active</span>
                </div>

                {/* 3-Pane VS Code Workspace Layout */}
                <div className="grid grid-cols-[48px_230px_1fr] bg-card/80 min-h-[380px]">
                  {/* 1. Far-Left VS Code Activity Bar Strip */}
                  <div className="border-r border-border/60 bg-muted/50 py-3 flex flex-col items-center gap-4 text-muted-foreground">
                    <Files className="h-5 w-5 hover:text-foreground cursor-pointer" />
                    <Search className="h-5 w-5 hover:text-foreground cursor-pointer" />
                    <GitBranch className="h-5 w-5 hover:text-foreground cursor-pointer" />
                    <Play className="h-5 w-5 hover:text-foreground cursor-pointer" />
                    {/* Highlighted DevSync Extension Icon */}
                    <div className="relative group p-1.5 rounded-lg border border-primary bg-primary/20 text-primary shadow-sm shadow-primary/30 cursor-pointer">
                      <Logo variant="original" width={20} height={20} />
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <Settings className="h-5 w-5 hover:text-foreground cursor-pointer mt-auto" />
                  </div>

                  {/* 2. DevSync Dedicated Sidebar View Container (devsyncSidebar) */}
                  <div className="border-r border-border/60 bg-muted/30 p-3 space-y-4 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-foreground text-xs pb-1 border-b border-border/40">
                      <span className="flex items-center gap-1.5">
                        <Logo variant="original" width={14} height={14} /> DevSync Guard
                      </span>
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </div>

                    {/* Section: Connected Environment */}
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Environment</div>
                      <div className="flex items-center gap-1.5 rounded border border-glass bg-card/60 p-1.5 text-foreground font-medium text-[10px]">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="truncate">Production (Neon PostgreSQL)</span>
                      </div>
                    </div>

                    {/* Section: Actions */}
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Quick Actions</div>
                      <button className="w-full flex items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/10 p-1.5 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors">
                        <Play className="h-3 w-3" /> Run Scan
                      </button>
                    </div>

                    {/* Section: Detected Drift Tree View */}
                    <div className="space-y-1.5 pt-1 border-t border-border/40">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-amber-400 font-semibold">
                        <span>{vscodeFixed ? "Drift Resolved (0)" : "Detected Drift (2)"}</span>
                        <span>{vscodeFixed ? "✓ SYNCED" : "▲ WARN"}</span>
                      </div>
                      {!vscodeFixed ? (
                        <div className="space-y-1 text-[10px]">
                          <div className="rounded p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300">
                            <div>⚠️ posts.published_at</div>
                            <div className="text-[9px] opacity-80">Type: String vs TIMESTAMP</div>
                          </div>
                          <div className="rounded p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300">
                            <div>❌ posts.author_id</div>
                            <div className="text-[9px] opacity-80">Missing column in live DB</div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px]">
                          ✔ All schema models match target database!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Main Code Editor Pane */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-[11px] text-muted-foreground">
                      <span className="text-foreground font-semibold border-b-2 border-primary pb-0.5">schema.prisma</span>
                      <span>DevSync ERD</span>
                    </div>

                    <div className="space-y-1 leading-6 text-foreground/90 font-mono text-xs">
                      <div><span className="text-purple-400 font-semibold">model</span> <span className="text-amber-300 font-semibold">Post</span> &#123;</div>
                      <div className="pl-4">id <span className="text-cyan-400">Int</span> <span className="text-purple-400">@id @default</span>(autoincrement())</div>

                      {vscodeFixed ? (
                        <>
                          <div className="pl-4 text-emerald-300 font-medium">
                            publishedAt <span className="text-cyan-400">DateTime?</span> <span className="text-emerald-400">// ✓ Synchronized with DB (TIMESTAMP)</span>
                          </div>
                          <div className="pl-4 text-emerald-300 font-medium">
                            authorId <span className="text-cyan-400">Int</span> <span className="text-emerald-400">// ✓ Migration preview generated</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="pl-4 relative inline-block group">
                            <span>publishedAt <span className="text-cyan-400">String?</span></span>
                            <span className="text-amber-400 font-medium ml-4">// ⚠️ Warning: Type in production DB is TIMESTAMP</span>
                            <div className="absolute left-0 bottom-0 w-full h-[2px] bg-amber-400/80 underline decoration-wavy decoration-amber-400" />
                          </div>
                          <div className="pl-4 relative inline-block group">
                            <span>authorId <span className="text-cyan-400">Int</span></span>
                            <span className="text-rose-400 font-medium ml-4">// ❌ Error: Column 'author_id' does not exist in target database</span>
                            <div className="absolute left-0 bottom-0 w-full h-[2px] bg-rose-500/80 underline decoration-wavy decoration-rose-500" />
                          </div>
                        </>
                      )}
                      <div>&#125;</div>
                    </div>

                    {/* Interactive Quick Fix Hover Card */}
                    {!vscodeFixed ? (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-amber-300 text-xs shadow-lg">
                        <div className="flex items-center gap-2 font-semibold text-amber-200">
                          <Zap className="h-4 w-4 text-amber-400 fill-amber-400" /> DevSync Sidebar Quick Fix:
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-200/90">
                          Synchronize local <code className="bg-amber-400/20 px-1 rounded">schema.prisma</code> definition or generate SQL migration to add missing <code className="bg-amber-400/20 px-1 rounded">author_id</code> column.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleApplyVscodeFix}
                            disabled={vscodeFixing}
                            className="flex items-center gap-2 rounded border border-amber-400/40 bg-amber-400/20 px-3 py-1.5 font-semibold hover:bg-amber-400/30 text-amber-100 transition-all shadow-md"
                          >
                            {vscodeFixing ? (
                              <>
                                <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-300" /> Applying Quick Fix...
                              </>
                            ) : (
                              <>
                                <MousePointer className="h-3.5 w-3.5 text-amber-300" /> ⚡ Apply Quick Fix: Sync with Production DB
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 text-emerald-300 text-xs shadow-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-emerald-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Quick Fix Applied Successfully! Schema synchronized.
                        </div>
                        <button
                          type="button"
                          onClick={() => setVscodeFixed(false)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Reset Demo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SURFACE 3: DATABASE VISUALIZER WORKFLOW (HIERARCHICAL ERD GRAPH WITH ANIMATED SVG FLOW) */}
            {surfaceIndex === 2 && (
              <div className="font-mono text-xs animate-in fade-in zoom-in-95 duration-300 min-w-[700px]">
                {/* Mobile Scroll Hint Banner */}
                <div className="sm:hidden bg-primary/10 border-b border-primary/20 px-4 py-1 text-[10px] text-primary flex items-center justify-between font-mono">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ArrowRight className="h-3 w-3 animate-pulse" /> Swipe right to view full ERD table topology
                  </span>
                  <span className="text-[9px] opacity-80">Full Graph</span>
                </div>
                {/* Canvas Controls Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3 text-muted-foreground text-[11px] gap-2">
                  <div className="flex items-center gap-2.5 font-semibold text-foreground">
                    <Network className="h-4 w-4 text-primary animate-pulse" />
                    <span>DevSync Hierarchical ERD Visualizer</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-emerald-500/20 px-2.5 py-0.5 text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Live SVG Relation Flow Active
                    </span>
                    <button className="rounded border border-glass bg-card px-2.5 py-1 text-foreground hover:border-primary/40">
                      Auto-Layout Hierarchy
                    </button>
                  </div>
                </div>

                {/* ERD Canvas Area with Hierarchical Layout & Visible Animated SVG Bezier Lines */}
                <div className="p-8 bg-card/70 min-h-[440px] relative overflow-hidden flex flex-col justify-between">
                  {/* Background Grid Pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

                  {/* SVG Bezier Connector Layer Overlay with CSS Animations */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <defs>
                      <linearGradient id="grad-synced-hero" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
                      </linearGradient>
                      <linearGradient id="grad-drift-hero" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                      </linearGradient>
                      <linearGradient id="grad-cyan-hero" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Bezier Line 1: USERS (Top) -> PROFILES (Bottom Left) */}
                    <path
                      d="M 280 130 C 280 190, 160 190, 160 250"
                      fill="none"
                      stroke="url(#grad-synced-hero)"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="animate-pulse"
                    />

                    {/* Bezier Line 2: USERS (Top) -> POSTS (Bottom Center - DRIFT!) */}
                    <path
                      d="M 340 130 C 340 190, 480 190, 480 250"
                      fill="none"
                      stroke="url(#grad-drift-hero)"
                      strokeWidth="3"
                      className="animate-pulse"
                    />

                    {/* Bezier Line 3: USERS (Top) -> ORDERS (Bottom Right) */}
                    <path
                      d="M 400 130 C 400 190, 800 190, 800 250"
                      fill="none"
                      stroke="url(#grad-cyan-hero)"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="animate-pulse"
                    />
                  </svg>

                  {/* HIERARCHICAL TIER 1: ROOT PARENT ENTITY (USERS TABLE AT TOP CENTER) */}
                  <div className="relative z-10 mx-auto max-w-sm w-full">
                    <div className="rounded-xl border border-primary/50 bg-card/95 shadow-2xl p-4 space-y-2.5 hover:border-primary transition-all ring-1 ring-primary/30">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="text-sm">users</span>
                          <span className="text-[9px] rounded bg-primary/20 px-1.5 py-0.5 text-primary">Root Entity</span>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-semibold">✓ SYNCED</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-foreground font-semibold bg-primary/10 px-2 py-1 rounded">
                          <span className="flex items-center gap-1.5"><Key className="h-3 w-3 text-amber-400" /> id</span>
                          <span className="text-muted-foreground text-[10px]">INT (PK) ●</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-0.5">
                          <span>email</span>
                          <span className="text-muted-foreground text-[10px]">VARCHAR(255)</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-0.5">
                          <span>name</span>
                          <span className="text-muted-foreground text-[10px]">VARCHAR(100)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Relational Direction Indicator */}
                  <div className="relative z-10 text-center font-mono text-[9px] text-muted-foreground uppercase tracking-widest my-4">
                    ▼ Foreign Key Relational Hierarchy (1:1 & 1:N Links)
                  </div>

                  {/* HIERARCHICAL TIER 2: CHILD RELATIONAL ENTITIES (PROFILES, POSTS, ORDERS AT BOTTOM) */}
                  <div className="relative z-10 grid grid-cols-3 gap-6 w-full min-w-[680px]">
                    {/* Child 1: PROFILES (Left - 1:1 Relation) */}
                    <div className="rounded-xl border border-glass bg-card/95 shadow-xl p-4 space-y-2.5 hover:border-primary/50 transition-all">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Database className="h-3.5 w-3.5 text-primary" />
                          <span>profiles</span>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-semibold">✓ SYNCED</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-foreground">
                          <span className="flex items-center gap-1 font-semibold"><Key className="h-3 w-3 text-amber-400" /> id</span>
                          <span className="text-muted-foreground text-[10px]">INT (PK)</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">
                          <span className="flex items-center gap-1">● user_id</span>
                          <span className="text-[9px]">FK ➔ users.id</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-0.5">
                          <span>bio</span>
                          <span className="text-muted-foreground text-[10px]">TEXT</span>
                        </div>
                      </div>
                    </div>

                    {/* Child 2: POSTS (Center - DRIFT WARNING!) */}
                    <div className="rounded-xl border border-amber-500/50 bg-card/95 shadow-2xl p-4 space-y-2.5 hover:border-amber-400 transition-all ring-2 ring-amber-500/30">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Database className="h-3.5 w-3.5 text-amber-400" />
                          <span>posts</span>
                        </div>
                        <span className="text-[9px] text-amber-400 font-bold animate-pulse">▲ 2 DRIFT ISSUES</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-foreground">
                          <span className="flex items-center gap-1 font-semibold"><Key className="h-3 w-3 text-amber-400" /> id</span>
                          <span className="text-muted-foreground text-[10px]">INT (PK)</span>
                        </div>
                        <div className="flex items-center justify-between text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                          <span className="flex items-center gap-1">● author_id</span>
                          <span className="text-[9px] font-bold">MISSING IN DB</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          <span>published_at</span>
                          <span className="text-[9px]">TYPE DRIFT</span>
                        </div>
                      </div>
                    </div>

                    {/* Child 3: ORDERS (Right - N:1 Relation) */}
                    <div className="rounded-xl border border-glass bg-card/95 shadow-xl p-4 space-y-2.5 hover:border-primary/50 transition-all">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Database className="h-3.5 w-3.5 text-primary" />
                          <span>orders</span>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-semibold">✓ SYNCED</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-foreground">
                          <span className="flex items-center gap-1 font-semibold"><Key className="h-3 w-3 text-amber-400" /> id</span>
                          <span className="text-muted-foreground text-[10px]">UUID (PK)</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-400 font-medium bg-cyan-500/10 px-2 py-0.5 rounded">
                          <span className="flex items-center gap-1">● user_id</span>
                          <span className="text-[9px]">FK ➔ users.id</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-0.5">
                          <span>total</span>
                          <span className="text-muted-foreground text-[10px]">DECIMAL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
