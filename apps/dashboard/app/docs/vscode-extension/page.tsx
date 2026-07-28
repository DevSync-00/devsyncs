import DocsContent from "@/components/docs/DocsContent";
import Section from "@/components/docs/Section";
import Subsection from "@/components/docs/Subsection";

export default function VSCodeExtensionPage() {
  return (
    <DocsContent
      title="VS Code Extension Guide"
      description="Get instant inline schema mismatch diagnostics, live file-watcher feedback, and interactive ERD webviews directly in VS Code."
      badge="IDE Extension"
    >
      <Section title="Overview">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The DevSync VS Code Extension provides real-time schema drift diagnostics directly inside your editor. As you edit your <code className="font-mono text-primary">schema.prisma</code>, <code className="font-mono text-primary">schema.sql</code>, or ORM models, the extension highlights column mismatches and type divergences before you commit.
        </p>
      </Section>

      <Section title="Key Features">
        <Subsection title="1. Inline Diagnostics & Squiggly Highlights">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mismatched field types (e.g. <code className="font-mono text-primary">String?</code> in code vs <code className="font-mono text-primary">TIMESTAMP</code> in database) are highlighted inline with quick-fix options.
          </p>
        </Subsection>

        <Subsection title="2. Entity Relationship Diagram (ERD) Webview">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Open the command palette (<code className="font-mono text-primary">Ctrl+Shift+P</code> or <code className="font-mono text-primary">Cmd+Shift+P</code>) and select <code className="font-mono text-primary">DevSync: Visualize ERD Diagram</code> to inspect a live relational graph of your database.
          </p>
        </Subsection>
      </Section>
    </DocsContent>
  );
}
