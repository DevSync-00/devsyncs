import { Eye, ShieldCheck, Undo2, KeyRound } from "lucide-react";

const pillars = [
  {
    icon: Eye,
    title: "Read-only first",
    description:
      "Scans inspect your project and database without writing changes. You stay in control from the first command.",
  },
  {
    icon: ShieldCheck,
    title: "Preview every fix",
    description:
      "Migrations and fixes are generated for review. Nothing hits your database until you explicitly approve apply.",
  },
  {
    icon: Undo2,
    title: "Reversible workflow",
    description:
      "Migration history and rollback paths help teams recover confidently when schema changes need to be undone.",
  },
  {
    icon: KeyRound,
    title: "Secrets stay local",
    description:
      "Credentials are masked in output. Auth tokens use secure storage in the extension and restricted config on CLI.",
  },
];

export default function Safety() {
  return (
    <section id="safety" className="py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 mesh-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Safety by design
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Production databases deserve{" "}
            <span className="text-gradient">caution, not chaos</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            DevSync is built for teams who treat every schema change as a risk —
            and want tooling that respects that.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="group p-6 rounded-2xl glass hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <pillar.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
