import { Check, LockKeyhole, ShieldCheck } from "lucide-react";

const checks = [
  ["Connection mode", "READ ONLY"],
  ["Destructive changes", "0"],
  ["Tables locked", "1"],
  ["Estimated duration", "240ms"],
  ["Rollback", "GENERATED"],
  ["Team approval", "REQUIRED"],
];

export default function Safety() {
  return (
    <section id="safety" className="border-b bg-card/30 py-20">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Production safety</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Every migration gets a preflight.</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Scanning never writes. Migration execution requires explicit authorization and leaves an audit trail your team can inspect.</p>
          <div className="mt-6 space-y-3 text-xs">
            {["Credentials are masked and encrypted", "Destructive operations are policy-gated", "Rollback SQL is generated before execution"].map((item) => (
              <div key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> {item}</div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="flex h-11 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2 font-mono text-[10px]"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> migration_preflight.json</div>
            <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-400"><LockKeyhole className="h-3 w-3" /> POLICY ENFORCED</span>
          </div>
          <div className="divide-y">
            {checks.map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 px-4 py-3 font-mono text-[10px]"><span className="text-muted-foreground">{label}</span><span className={value === "READ ONLY" || value === "GENERATED" ? "text-emerald-400" : value === "REQUIRED" ? "text-amber-400" : ""}>{value}</span></div>
            ))}
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 font-mono text-[9px] text-muted-foreground">sha256:a89d2f3c · actor: deploy-bot · environment: production</div>
        </div>
      </div>
    </section>
  );
}
