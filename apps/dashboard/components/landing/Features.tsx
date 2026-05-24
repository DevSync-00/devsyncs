import {
  Database,
  GitBranch,
  Terminal,
  LayoutDashboard,
  Shield,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Multi-schema detection",
    description:
      "Prisma, Supabase, TypeORM, Drizzle, Django, SQLAlchemy, and raw SQL — normalized into one canonical view.",
    span: "lg:col-span-2",
    featured: true,
  },
  {
    icon: Shield,
    title: "Migration safety checks",
    description:
      "Preview SQL before apply. Block destructive changes unless you explicitly opt in.",
    span: "",
    featured: false,
  },
  {
    icon: Terminal,
    title: "CLI workflow",
    description:
      "init, scan, status, fix, migrate — built for scripts and CI pipelines.",
    span: "",
    featured: false,
  },
  {
    icon: LayoutDashboard,
    title: "Team dashboard",
    description:
      "Projects, scan history, mismatches, and migration timelines in one place.",
    span: "",
    featured: false,
  },
  {
    icon: GitBranch,
    title: "VS Code extension",
    description:
      "Run scans and review fixes without leaving your editor. Secure token storage built in.",
    span: "",
    featured: false,
  },
  {
    icon: Sparkles,
    title: "AI-assisted reasoning",
    description:
      "Structured explanations and fix suggestions — reviewable, not auto-applied.",
    span: "lg:col-span-2",
    featured: true,
  },
];

const Features = () => {
  return (
    <section id="features" className="py-28 px-6 bg-secondary/15 relative">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Capabilities
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Everything you need to{" "}
            <span className="text-gradient">stay aligned</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            From local development to team review — one toolchain for schema truth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group relative p-7 rounded-2xl border transition-all duration-300 overflow-hidden ${
                feature.featured
                  ? "gradient-card border-primary/20 hover:border-primary/40 hover:glow-primary"
                  : "glass hover:border-primary/30"
              } ${feature.span}`}
            >
              {feature.featured && (
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/15 transition-colors" />
              )}
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                    feature.featured
                      ? "gradient-primary"
                      : "bg-primary/10 border border-primary/20"
                  }`}
                >
                  <feature.icon
                    className={`w-6 h-6 ${
                      feature.featured ? "text-primary-foreground" : "text-primary"
                    }`}
                  />
                </div>
                <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
