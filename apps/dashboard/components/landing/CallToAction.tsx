"use client";

import Link from "next/link";
import { ArrowRight, Check, Clipboard, Terminal } from "lucide-react";
import { useState } from "react";

const commands = ["npm install -g @devsync/cli", "dev-sync init", "dev-sync scan"];

export default function CallToAction() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(commands.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="relative py-28 overflow-hidden bg-ambient-glow">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-glass bg-card/90 backdrop-blur-xl shadow-2xl">
          <div className="grid lg:grid-cols-[1fr_.9fr]">
            <div className="p-8 sm:p-12 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">Start Locally in Seconds</p>
              <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">Catch drift before your customers do.</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Connect your repository, run a read-only schema scan, and review exact SQL diffs before shipping to production.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Link href="/auth/signup" className="inline-flex h-11 sm:h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 font-mono text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
                  Start scanning free <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/docs" className="inline-flex h-11 sm:h-10 w-full sm:w-auto items-center justify-center rounded-md border bg-card px-4 py-2.5 font-mono text-xs text-foreground hover:bg-muted transition-colors">
                  Read documentation
                </Link>
              </div>
            </div>
            <button onClick={copy} className="group border-t bg-muted/20 p-8 text-left lg:border-l lg:border-t-0 hover:bg-muted/40 transition-colors flex flex-col justify-between">
              <div>
                <div className="mb-6 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-2 font-semibold text-foreground/80"><Terminal className="h-3.5 w-3.5 text-primary" /> install.sh</span>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" /> : <Clipboard className="h-3.5 w-3.5 group-hover:text-foreground transition-colors" />}
                </div>
                <div className="space-y-3 font-mono text-xs">
                  {commands.map((command) => (
                    <div key={command} className="flex items-center gap-2">
                      <span className="text-primary font-bold">$</span>
                      <span className="text-foreground/90 font-medium">{command}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 font-mono text-[10px] text-muted-foreground flex items-center justify-between">
                <span>click snippet to copy all commands</span>
                <span className="text-primary group-hover:underline">Copy snippet →</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
