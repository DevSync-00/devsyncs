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
      <div className="absolute inset-0 mesh-grid opacity-50" />
      <div className="relative mx-auto grid min-h-[760px] max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.82fr_1.18fr] lg:py-24">
        <div>
          <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Database change control for engineering teams
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl xl:text-6xl">
            Database schema drift, caught before deploy.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            Compare code against live databases, review the exact SQL diff, and ship approved migrations through CLI, VS Code, and CI.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/signup" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-mono text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Start scanning <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/docs" className="inline-flex h-10 items-center rounded-md border bg-card px-4 font-mono text-xs hover:bg-muted">
              Read quickstart
            </Link>
          </div>
          <button onClick={copy} className="mt-5 flex w-full max-w-sm items-center gap-3 rounded-md border bg-[#080c12] px-3 py-2.5 text-left font-mono text-xs text-slate-300">
            <span className="text-cyan-400">$</span>
            <span className="flex-1">{command}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
          </button>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] text-muted-foreground">
            <span>✓ Read-only by default</span><span>✓ No credit card</span><span>✓ PostgreSQL compatible</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-2xl shadow-black/20">
          <div className="flex h-11 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-primary" /> acme-api / schema-check
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> main</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> production</span>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_210px]">
            <div className="min-w-0 border-b lg:border-b-0 lg:border-r">
              <div className="flex h-9 items-center gap-4 border-b bg-muted/20 px-4 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <span className="text-foreground">Schema diff</span><span>Generated SQL</span><span>Rollback</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-slate-400"><code>{`model Post {
  id          Int       @id
  title       String
- publishedAt String?
+ publishedAt DateTime?
+ authorId    Int
}

table profiles
+ bio         text
+ user_id     integer not null`}</code></pre>
              <div className="border-t bg-[#080c12] p-4 font-mono text-[10px] leading-5">
                <div className="text-slate-500">$ dev-sync scan --check</div>
                <div className="text-amber-400">WARN  2 schema changes detected</div>
                <div className="text-slate-500">INFO  migration preview generated</div>
                <div className="text-emerald-400">PASS  rollback plan available</div>
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Preflight</div>
              <dl className="mt-4 space-y-3 font-mono text-[10px]">
                {[
                  ["Risk", "LOW", "text-emerald-400"],
                  ["Destructive", "0", ""],
                  ["Lock time", "~240ms", ""],
                  ["Rollback", "READY", "text-emerald-400"],
                  ["Approval", "REQUIRED", "text-amber-400"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex justify-between gap-3 border-b pb-2">
                    <dt className="text-muted-foreground">{label}</dt><dd className={tone}>{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/auth/signup" className="mt-5 flex h-8 items-center justify-center gap-2 rounded border border-primary/30 bg-primary/10 font-mono text-[10px] text-primary">
                Review migration <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
