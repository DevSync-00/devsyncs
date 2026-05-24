import { Search, FileSearch, CheckSquare } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Scan",
    description:
      "Point DevSync at your project. It reads schema definitions (Prisma, Supabase, TypeORM, and more) and compares them to your live or inferred database.",
    command: "devsync scan",
  },
  {
    icon: FileSearch,
    title: "Diagnose",
    description:
      "Get a structured report of mismatches — missing columns, type drift, outdated migrations — with enough context to act, not guess.",
    command: "devsync status",
  },
  {
    icon: CheckSquare,
    title: "Fix & apply",
    description:
      "Generate migration previews, review in CLI or dashboard, then apply only when your team explicitly approves. No silent writes.",
    command: "devsync fix → apply",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-20 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Workflow
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Three steps to <span className="text-gradient">confident sync</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A deliberate pipeline — not a black box that mutates your database.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="relative group">
              {index < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-16 -right-4 w-8 h-px bg-gradient-to-r from-primary/50 to-transparent z-10"
                  aria-hidden
                />
              )}

              <div className="h-full p-8 rounded-2xl gradient-card border border-border/80 hover:border-primary/40 transition-all duration-300 hover:shadow-elevated">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                    <step.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <span className="font-display text-5xl font-bold text-muted-foreground/20">
                    0{index + 1}
                  </span>
                </div>

                <h3 className="font-display text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {step.description}
                </p>

                <code className="inline-block font-mono text-xs px-3 py-1.5 rounded-lg bg-background/80 border border-border text-primary">
                  {step.command}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
