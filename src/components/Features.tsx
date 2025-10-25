import { Database, Wrench, Code2, GitMerge, Shield, Users } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "AI-Powered Schema Syncing",
    description: "Detects and corrects mismatches in seconds with intelligent analysis.",
  },
  {
    icon: Wrench,
    title: "Smart Migration Suggestions",
    description: "Generates SQL or Prisma migration scripts automatically.",
  },
  {
    icon: Code2,
    title: "Code–DB Auto-Refactor",
    description: "Keeps your codebase consistent with your schema at all times.",
  },
  {
    icon: GitMerge,
    title: "CI/CD Integration",
    description: "Sync logic built into your pipelines for seamless deployment.",
  },
  {
    icon: Shield,
    title: "Error Prevention Engine",
    description: "Stops breaking changes before deployment with smart validation.",
  },
  {
    icon: Users,
    title: "Team Insights Dashboard",
    description: "Collaboration view for teams with detailed CI logs and analytics.",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-6 bg-secondary/30">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Built for <span className="text-gradient">Modern Teams</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to keep your development workflow in perfect harmony
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
