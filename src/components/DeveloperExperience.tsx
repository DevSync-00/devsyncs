import { Terminal } from "lucide-react";

const DeveloperExperience = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="container mx-auto max-w-5xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Developer <span className="text-gradient">Experience</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Powerful CLI commands. AI-powered insights. Zero configuration required.
          </p>
        </div>

        <div className="relative">
          {/* Terminal window */}
          <div className="relative rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm shadow-2xl glow-primary overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-accent" />
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-mono">terminal</span>
              </div>
            </div>

            {/* Terminal content */}
            <div className="p-6 font-mono text-sm space-y-4">
              {/* Command 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-primary">$</span>
                  <span className="text-foreground">devsync scan --path . --db $DATABASE_URL</span>
                </div>
                <div className="pl-4 space-y-1">
                  <div className="flex items-center gap-2 animate-fade-in">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Scanning Prisma schema...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-300">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Extracting database schema...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-500">
                    <span className="text-accent">→</span>
                    <span className="text-foreground">Found 3 mismatches</span>
                  </div>
                  <div className="pl-4 space-y-1 text-muted-foreground animate-fade-in delay-700">
                    <div>❌ MISSING_TABLE: notifications (code expects, DB missing)</div>
                    <div>⚠️  MISSING_FIELD: users.deleted_at (nullable timestamp)</div>
                    <div>ℹ️  EXTRA_FIELD: projects.created_at (in DB, not in code)</div>
                  </div>
                </div>
              </div>

              {/* Command 2 */}
              <div className="space-y-2 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-primary">$</span>
                  <span className="text-foreground">devsync migrate --path . --db $DATABASE_URL</span>
                </div>
                <div className="pl-4 space-y-1 animate-fade-in delay-1000">
                  <div className="flex items-center gap-2">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Generating migration SQL...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-1200">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">AI analyzing risks...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-1400">
                    <span className="text-primary">✓</span>
                    <span className="text-primary font-semibold">Migration generated: .devsync/migration.sql</span>
                  </div>
                  <div className="pl-4 text-xs text-muted-foreground animate-fade-in delay-1600">
                    <div>CREATE TABLE notifications (...)</div>
                    <div>ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;</div>
                  </div>
                </div>
              </div>

              {/* Cursor blink */}
              <div className="flex items-center gap-2 pt-4">
                <span className="text-primary">$</span>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
              </div>
            </div>
          </div>

          {/* Code snippet decoration */}
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-pulse-slow delay-1000 pointer-events-none" />
        </div>

        {/* Bottom tagline */}
        <div className="text-center mt-12">
          <p className="text-lg text-muted-foreground italic">
            "Catch schema mismatches before they reach production. Generate migrations in seconds. Sleep better at night."
          </p>
        </div>
      </div>
    </section>
  );
};

export default DeveloperExperience;
