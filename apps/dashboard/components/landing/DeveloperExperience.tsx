import Link from "next/link";
import { Terminal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DeveloperExperience = () => {
  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 mesh-grid opacity-30 pointer-events-none" />

      <div className="container mx-auto max-w-5xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
              Developer experience
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Your terminal,{" "}
              <span className="text-gradient">your rules</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Run scans locally, pipe into CI, or trigger from VS Code. Every
              command follows the same safety model: inspect first, apply only
              when you mean to.
            </p>
            <Link href="/docs">
              <Button variant="outline" className="group border-primary/30">
                CLI quickstart
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-2xl opacity-50" />
            <div className="relative rounded-2xl border border-white/10 glass-strong shadow-elevated overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-secondary/40">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">zsh</span>
                </div>
              </div>

              <div className="p-5 sm:p-6 font-mono text-xs sm:text-sm space-y-5 bg-background/60">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-primary">$</span>{" "}
                    <span className="text-foreground">devsync scan --path ./api</span>
                  </div>
                  <div className="pl-4 text-muted-foreground">→ 2 mismatches · preview saved</div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-primary">$</span>{" "}
                    <span className="text-foreground">
                      devsync fix --path ./api --db $DATABASE_URL
                    </span>
                  </div>
                  <div className="pl-4 text-muted-foreground">
                    → Migration SQL generated (not applied)
                  </div>
                  <div className="pl-4 text-amber-400/90">
                    ⚠ Review output before apply
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-primary">$</span>{" "}
                    <span className="text-foreground">devsync apply</span>
                  </div>
                  <div className="pl-4 text-muted-foreground">
                    → Blocked until explicitly confirmed
                  </div>
                  <div className="pl-4 text-emerald-400/90 flex items-center gap-1.5">
                    <span>✓</span> Applied after team approval
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <span className="text-primary">$</span>
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeveloperExperience;
