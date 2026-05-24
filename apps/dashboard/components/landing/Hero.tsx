import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
} from "lucide-react";

const Hero = () => {
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

            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60 bg-secondary/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="ml-3 text-xs font-mono text-muted-foreground">
                devsync scan — ./my-app
              </span>
            </div>

            <div className="grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border/60">
              <div className="md:col-span-2 p-5 font-mono text-xs sm:text-sm space-y-3 bg-background/40">
                <div className="text-muted-foreground">
                  <span className="text-primary">$</span> devsync scan
                </div>
                <div className="text-muted-foreground pl-2">
                  → Project: my-saas-api
                </div>
                <div className="text-muted-foreground pl-2">
                  → Schema: Prisma · DB: PostgreSQL
                </div>
                <div className="pl-2 flex items-start gap-2 text-amber-400/90">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>2 mismatches detected</span>
                </div>
                <div className="pl-4 space-y-1 text-muted-foreground border-l border-amber-500/30 ml-2">
                  <div>User.profile — missing in DB</div>
                  <div>Post.publishedAt — type mismatch</div>
                </div>
                <div className="pl-2 flex items-center gap-2 text-emerald-400/90">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Preview ready — awaiting review</span>
                </div>
              </div>

              <div className="md:col-span-3 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Scan summary</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    2 issues
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: FileCode2, label: "Models scanned", value: "24" },
                    { icon: Database, label: "Tables in DB", value: "22" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 rounded-xl bg-secondary/50 border border-border/60"
                    >
                      <stat.icon className="w-4 h-4 text-primary mb-2" />
                      <p className="text-2xl font-bold font-display">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {["Generate migration preview", "Share with team", "Apply when approved"].map(
                    (step, i) => (
                      <div
                        key={step}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-card/50 border border-border/40 text-sm"
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                            i === 0
                              ? "gradient-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                          {step}
                        </span>
                      </div>
                    )
                  )}
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
