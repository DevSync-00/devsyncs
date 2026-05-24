import { Code2, Database, Workflow } from "lucide-react";

const integrations = [
  {
    category: "Editors & CLI",
    icon: Code2,
    status: "available" as const,
    tools: [
      { name: "VS Code extension", badge: "Live" },
      { name: "DevSync CLI", badge: "Live" },
      { name: "Device auth flow", badge: "Live" },
    ],
  },
  {
    category: "Schema & databases",
    icon: Database,
    status: "available" as const,
    tools: [
      { name: "Prisma", badge: "Live" },
      { name: "Supabase", badge: "Live" },
      { name: "PostgreSQL", badge: "Live" },
      { name: "TypeORM · Drizzle · Django", badge: "Live" },
    ],
  },
  {
    category: "Pipelines",
    icon: Workflow,
    status: "planned" as const,
    tools: [
      { name: "GitHub Actions", badge: "Soon" },
      { name: "GitLab CI", badge: "Soon" },
      { name: "Pre-deploy drift checks", badge: "Soon" },
    ],
  },
];

const Integrations = () => {
  return (
    <section className="py-28 px-6 bg-secondary/15 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Integrations
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Fits your <span className="text-gradient">existing stack</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Honest status labels — live today, or clearly marked as coming soon.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.category}
              className="p-7 rounded-2xl glass border border-border/80 hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
                    <integration.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">{integration.category}</h3>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                    integration.status === "available"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {integration.status === "available" ? "Available" : "Roadmap"}
                </span>
              </div>

              <div className="space-y-2">
                {integration.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-background/50 border border-border/60 hover:border-primary/20 transition-colors"
                  >
                    <span className="text-sm font-medium">{tool.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        tool.badge === "Live"
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground bg-muted"
                      }`}
                    >
                      {tool.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Integrations;
