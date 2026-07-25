"use client";

import Link from "next/link";
import { Check, Clipboard, Terminal } from "lucide-react";
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
    <section className="py-24">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid lg:grid-cols-[1fr_.9fr]">
            <div className="p-8 sm:p-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Start locally</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your first drift report is one command away.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Connect a project, run a read-only scan, and review the result before creating an account-wide workflow.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/auth/signup" className="rounded-md bg-primary px-4 py-2.5 font-mono text-xs text-primary-foreground">Start free</Link>
                <Link href="/docs" className="rounded-md border px-4 py-2.5 font-mono text-xs hover:bg-muted">Read quickstart</Link>
              </div>
            </div>
            <button onClick={copy} className="group border-t bg-[#080c12] p-6 text-left lg:border-l lg:border-t-0">
              <div className="mb-5 flex items-center justify-between font-mono text-[10px] text-slate-500"><span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> install.sh</span>{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5 group-hover:text-slate-300" />}</div>
              <div className="space-y-3 font-mono text-[11px]">
                {commands.map((command) => <div key={command}><span className="text-cyan-400">$</span> <span className="text-slate-300">{command}</span></div>)}
              </div>
              <div className="mt-6 font-mono text-[9px] text-slate-600">click to copy all commands</div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
