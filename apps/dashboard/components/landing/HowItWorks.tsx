import { Check, FileDiff, ScanSearch, ShieldCheck } from "lucide-react";

const steps = [
  { icon: ScanSearch, number: "01", title: "Detect", command: "dev-sync scan --check", text: "Normalize your ORM schema and compare it with the selected database environment." },
  { icon: FileDiff, number: "02", title: "Review", command: "dev-sync fix --preview", text: "Inspect object-level drift, generated SQL, lock estimates, and rollback coverage." },
  { icon: ShieldCheck, number: "03", title: "Ship", command: "dev-sync apply --confirm", text: "Require explicit approval, execute the migration, and retain a complete audit trail." },
];

export default function HowItWorks() {
  return (
    <section id="workflow" className="border-b py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Change pipeline</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Detect. Review. Ship.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">A visible workflow with explicit state transitions—not a black box connected to production.</p>
        </div>
        <div className="grid overflow-hidden rounded-lg border bg-card lg:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="border-b p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <div className="flex items-center justify-between">
                <step.icon className="h-4 w-4 text-primary" />
                <span className="font-mono text-[10px] text-muted-foreground">{step.number}</span>
              </div>
              <h3 className="mt-8 font-mono text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 min-h-12 text-xs leading-5 text-muted-foreground">{step.text}</p>
              <code className="mt-5 block rounded border bg-background px-3 py-2 font-mono text-[10px] text-cyan-400">$ {step.command}</code>
              <div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase text-emerald-400"><Check className="h-3 w-3" /> observable and auditable</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
