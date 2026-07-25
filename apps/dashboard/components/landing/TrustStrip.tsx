const rows = [
  ["ORM", "Prisma", "Drizzle", "TypeORM", "Sequelize", "Django"],
  ["Database", "PostgreSQL", "Supabase", "Neon", "Raw SQL"],
  ["Workflow", "CLI", "VS Code", "Dashboard", "GitHub Actions"],
];

export default function TrustStrip() {
  return (
    <section id="integrations" className="border-b bg-card/40">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="overflow-x-auto rounded-lg border bg-background">
          {rows.map(([category, ...tools]) => (
            <div key={category} className="grid min-w-[720px] grid-cols-[120px_repeat(5,1fr)] border-b last:border-b-0">
              <div className="bg-muted/20 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{category}</div>
              {tools.map((tool) => <div key={tool} className="border-l px-4 py-3 font-mono text-[11px]">{tool}</div>)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
