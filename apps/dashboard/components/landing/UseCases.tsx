import { Building2, Rocket, Users } from "lucide-react";

const personas = [
  {
    icon: Building2,
    title: "Platform & backend teams",
    description:
      "Catch schema drift across staging and production before deploys. Review migrations as a team in the dashboard.",
    highlight: "Multi-environment parity",
  },
  {
    icon: Rocket,
    title: "Fast-moving startups",
    description:
      "Ship features without silent DB breakage. Scan on every change, fix with confidence when mismatches appear.",
    highlight: "Ship faster, break less",
  },
  {
    icon: Users,
    title: "Distributed engineering",
    description:
      "Share scan reports, approval workflows, and migration history so everyone works from the same schema truth.",
    highlight: "One source of truth",
  },
];

export default function UseCases() {
  return (
    <section className="py-28 px-6 bg-secondary/20 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Built for real workflows
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Who uses <span className="text-gradient">DevSync</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Whether you run a solo project or a platform team, schema sync should
            feel deliberate — not accidental.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {personas.map((persona) => (
            <article
              key={persona.title}
              className="relative p-8 rounded-2xl gradient-card border border-border/80 hover:border-primary/40 transition-all duration-300 group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-6">
                  <persona.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-4">
                  {persona.highlight}
                </span>
                <h3 className="text-xl font-bold mb-3">{persona.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {persona.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
