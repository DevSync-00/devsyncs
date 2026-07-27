"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Clipboard, Database, GitBranch, Terminal } from "lucide-react";

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const command = "npx dev-sync scan";

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section id="product" className="relative overflow-hidden border-b pt-14">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="relative mx-auto grid min-h-[760px] max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.82fr_1.18fr] lg:py-24">
        <div>
          <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Database change control for engineering teams
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl xl:text-6xl">
            Continuous Database Integration & Drift Prevention.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            Detect schema divergence in pull requests, review exact SQL diffs, and ship zero-downtime database changes across every environment.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/signup" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 font-mono text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
              Start scanning free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/docs" className="inline-flex h-10 items-center rounded-md border bg-card px-4 font-mono text-xs hover:bg-muted transition-colors">
              Read quickstart
            </Link>
          </div>
          <button onClick={copy} className="mt-5 flex w-full max-w-sm items-center gap-3 rounded-md border bg-card px-3.5 py-2.5 text-left font-mono text-xs text-foreground hover:border-primary/40 transition-colors shadow-sm">
            <span className="text-primary">$</span>
            <span className="flex-1 font-medium">{command}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] text-muted-foreground">
            <span>✓ Read-only by default</span><span>✓ No credit card</span><span>✓ Postgres & Supabase ready</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-2xl">
          <div className="flex h-11 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-primary" /> acme-api / schema-check
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> main</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> production</span>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_210px]">
            <div className="min-w-0 border-b lg:border-b-0 lg:border-r">
              <div className="flex h-9 items-center gap-4 border-b bg-muted/30 px-4 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <span className="text-foreground font-semibold">Schema diff</span><span>Generated SQL</span><span>Rollback</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-foreground/80"><code>{`model Post {
  id          Int       @id
  title       String
- publishedAt String?
+ publishedAt DateTime?
+ authorId    Int
}

table profiles
+ bio         text
+ user_id     integer not null`}</code></pre>
              <div className="border-t bg-muted/20 p-4 font-mono text-[10px] leading-5">
                <div className="text-muted-foreground">$ dev-sync scan --check</div>
                <div className="text-amber-500 font-semibold">WARN  2 schema changes detected</div>
                <div className="text-muted-foreground">INFO  migration preview generated</div>
                <div className="text-emerald-500 font-semibold">PASS  rollback plan available</div>
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Preflight</div>
              <dl className="mt-4 space-y-3 font-mono text-[10px]">
                {[
                  ["Risk Score", "LOW", "text-emerald-500 font-semibold"],
                  ["Destructive", "0", ""],
                  ["Lock time", "~240ms", ""],
                  ["Rollback", "READY", "text-emerald-500 font-semibold"],
                  ["Approval", "REQUIRED", "text-amber-500 font-semibold"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex justify-between gap-3 border-b pb-2">
                    <dt className="text-muted-foreground">{label}</dt><dd className={tone}>{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/auth/signup" className="mt-5 flex h-8 items-center justify-center gap-2 rounded border border-primary/30 bg-primary/10 font-mono text-[10px] text-primary hover:bg-primary/20 transition-colors">
                Review migration <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
