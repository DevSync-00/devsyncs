import { Code2, Database, GitBranch } from "lucide-react";

const integrations = [
  {
    category: "IDE",
    icon: Code2,
    tools: ["Cursor", "VS Code", "JetBrains"],
  },
  {
    category: "Databases",
    icon: Database,
    tools: ["Supabase", "PostgreSQL", "Firebase"],
  },
  {
    category: "DevOps Tools",
    icon: GitBranch,
    tools: ["GitHub Actions", "Docker", "Vercel"],
  },
];

const Integrations = () => {
  return (
    <section className="py-24 px-6 bg-secondary/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Works With Your <span className="text-gradient">Entire Stack</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Seamlessly integrates with the tools you already use
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {integrations.map((integration) => (
            <div
              key={integration.category}
              className="p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 hover:glow-primary"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
                  <integration.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold">{integration.category}</h3>
              </div>
              <div className="space-y-3">
                {integration.tools.map((tool) => (
                  <div
                    key={tool}
                    className="px-4 py-3 rounded-lg bg-secondary/50 border border-border text-foreground font-medium hover:border-primary/30 transition-colors"
                  >
                    {tool}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Additional note */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            + Many more integrations coming soon
          </p>
        </div>
      </div>
    </section>
  );
};

export default Integrations;
