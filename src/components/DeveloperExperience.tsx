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
            Command-line simplicity. AI-level intelligence.
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
                  <span className="text-foreground">devsync detect</span>
                </div>
                <div className="pl-4 space-y-1">
                  <div className="flex items-center gap-2 animate-fade-in">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Scanning IDE and database...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-500">
                    <span className="text-accent">→</span>
                    <span className="text-foreground">2 mismatched models found</span>
                  </div>
                  <div className="pl-4 space-y-1 text-muted-foreground animate-fade-in delay-1000">
                    <div>• User.profile (missing in DB)</div>
                    <div>• Post.publishedAt (type mismatch)</div>
                  </div>
                </div>
              </div>

              {/* Command 2 */}
              <div className="space-y-2 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-primary">$</span>
                  <span className="text-foreground">devsync fix --apply</span>
                </div>
                <div className="pl-4 space-y-1 animate-fade-in delay-1500">
                  <div className="flex items-center gap-2">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Generating migration script...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-2000">
                    <span className="text-accent">→</span>
                    <span className="text-muted-foreground">Applying changes...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-fade-in delay-2500">
                    <span className="text-primary">✓</span>
                    <span className="text-primary font-semibold">Schema and models synced successfully</span>
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
            "Your AI DevOps teammate that never sleeps."
          </p>
        </div>
      </div>
    </section>
  );
};

export default DeveloperExperience;
