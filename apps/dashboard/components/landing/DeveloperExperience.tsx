import { Check, Code2, GitPullRequest, Terminal } from "lucide-react";

export default function DeveloperExperience() {
  return (
    <section className="border-b py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">One engine, every surface</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Local feedback. CI enforcement. Team approval.</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-lg border bg-[#080c12]">
            <div className="flex h-10 items-center gap-2 border-b border-white/10 px-4 font-mono text-[10px] text-slate-400"><Terminal className="h-3.5 w-3.5" /> CLI</div>
            <pre className="p-4 font-mono text-[10px] leading-6 text-slate-400"><code><span className="text-cyan-400">$</span>{` dev-sync scan
INFO  prisma schema loaded
INFO  production connected
`}<span className="text-amber-400">WARN  2 mismatches found</span>{`
PASS  rollback generated`}</code></pre>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex h-10 items-center gap-2 border-b px-4 font-mono text-[10px] text-muted-foreground"><Code2 className="h-3.5 w-3.5" /> VS Code / schema.prisma</div>
            <div className="p-4 font-mono text-[10px] leading-6 text-muted-foreground">
              <div><span className="text-violet-400">model</span> Post {"{"}</div>
              <div className="pl-4">publishedAt <span className="border-b border-amber-400 text-foreground">String?</span></div>
              <div>{"}"}</div>
              <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/10 p-2 text-amber-400">Type differs from production: timestamp</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex h-10 items-center gap-2 border-b px-4 font-mono text-[10px] text-muted-foreground"><GitPullRequest className="h-3.5 w-3.5" /> Pull request checks</div>
            <div className="space-y-2 p-4 font-mono text-[10px]">
              <div className="flex items-center justify-between rounded border p-3"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> dev-sync/schema-check</span><span className="text-emerald-400">Passed</span></div>
              <div className="flex items-center justify-between rounded border p-3"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> migration/preflight</span><span className="text-emerald-400">Passed</span></div>
              <pre className="mt-3 rounded border bg-background p-3 text-muted-foreground"><code>{`- name: Check schema drift
  run: npx dev-sync scan --check`}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
