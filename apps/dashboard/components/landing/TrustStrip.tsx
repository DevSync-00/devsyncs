const drivers = [
  "PostgreSQL", "Supabase", "Neon DB", "Prisma ORM", "Drizzle ORM", "TypeORM", "Kysely", "Django ORM", "Raw SQL"
];

export default function TrustStrip() {
  return (
    <section id="integrations" className="border-b bg-card/30 py-8 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Seamless Native Integration Across Your Stack
        </div>
        <div className="relative mask-edge-fade overflow-hidden py-2">
          <div className="animate-marquee gap-8">
            {[...drivers, ...drivers].map((driver, index) => (
              <div
                key={`${driver}-${index}`}
                className="flex items-center gap-2 rounded-full border border-glass bg-card/60 px-4 py-1.5 font-mono text-xs font-medium text-foreground/80 hover:border-primary/40 hover:text-foreground transition-all shadow-sm shrink-0"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                {driver}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
