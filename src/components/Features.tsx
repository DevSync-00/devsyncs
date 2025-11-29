import { Database, Wrench, Code2, GitMerge, Shield, Users } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "9+ Schema Types Supported",
    description: "Works with Prisma, Supabase, TypeORM, Kysely, Sequelize, Drizzle, Django, SQLAlchemy, and Raw SQL. AI infers schemas from code patterns when definitions are missing.",
  },
  {
    icon: Wrench,
    title: "Intelligent Migration Generation",
    description: "Automatically generates SQL migrations with risk assessment, rollback scripts, and AI-powered explanations. Review and apply with one click.",
  },
  {
    icon: Code2,
    title: "AI-Powered Code Analysis",
    description: "Infers database schemas directly from your code patterns—no migration files needed. Works with OpenAI or free local Ollama models.",
  },
  {
    icon: GitMerge,
    title: "GitHub Actions Integration",
    description: "Automatically scans on every PR, comments with mismatch reports, and prevents merging critical schema issues. Zero configuration required.",
  },
  {
    icon: Shield,
    title: "Production-Safe Validation",
    description: "Detects breaking changes before deployment. Categorizes mismatches by severity (error/warning/info) and provides safe migration paths.",
  },
  {
    icon: Users,
    title: "Team Collaboration Hub",
    description: "Shared projects, team permissions, migration history, and real-time sync status. Keep your entire team aligned on schema changes.",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-6 bg-secondary/30">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Enterprise-Grade <span className="text-gradient">Schema Management</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From AI-powered detection to automated migrations—everything you need to eliminate schema drift and keep your stack perfectly synchronized
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 hover:glow-primary"
            >
              <div className="mb-5">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
