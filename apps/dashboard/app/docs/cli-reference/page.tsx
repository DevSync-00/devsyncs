import DocsContent from "@/components/docs/DocsContent";
import Section from "@/components/docs/Section";
import Subsection from "@/components/docs/Subsection";
import CodeBlock from "@/components/docs/CodeBlock";

export default function CLIReferencePage() {
  return (
    <DocsContent
      title="@devsync/cli Command Reference"
      description="Complete command-line interface documentation for scanning schema drift, dry-run migration generation, and platform synchronization."
      badge="CLI v0.2.0"
    >
      <Section title="Overview">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <code className="font-mono text-primary">@devsync/cli</code> is a developer-first tool designed to extract local codebase schemas (Prisma, Drizzle, TypeORM, Kysely), connect to target database environments read-only, and generate deterministic migration previews without modifying your database.
        </p>
        <CodeBlock language="bash">
{`npm install -g @devsync/cli
dev-sync --help`}
        </CodeBlock>
      </Section>

      <Section title="Primary Commands">
        <Subsection title="1. dev-sync scan">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Scans local ORM files against your target database to detect structural mismatches, missing columns, type differences, or unindexed foreign keys.
          </p>
          <CodeBlock language="bash">
{`dev-sync scan \\
  --schema ./prisma/schema.prisma \\
  --db "postgresql://user:pass@localhost:5432/mydb" \\
  --check`}
          </CodeBlock>
          <div className="rounded-lg border border-glass bg-card/60 p-4 font-mono text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground">Command Flags:</div>
            <div><code className="text-primary">--schema &lt;path&gt;</code> Path to local ORM schema file</div>
            <div><code className="text-primary">--db &lt;url&gt;</code> Target database connection string</div>
            <div><code className="text-primary">--check</code> Exit code 1 if drift is detected (Ideal for CI/CD)</div>
            <div><code className="text-primary">--json</code> Output structured JSON scan report</div>
          </div>
        </Subsection>

        <Subsection title="2. dev-sync fix">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Generates DDL SQL migration statements and rollback strategies for all detected schema mismatches.
          </p>
          <CodeBlock language="bash">
{`dev-sync fix --preview`}
          </CodeBlock>
        </Subsection>

        <Subsection title="3. dev-sync init">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Initializes a local project configuration file (<code className="font-mono text-primary">.devsync/config.json</code>).
          </p>
          <CodeBlock language="bash">
{`dev-sync init`}
          </CodeBlock>
        </Subsection>

        <Subsection title="4. dev-sync login">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Authenticates your CLI session with your Dev-Sync.dev cloud workspace.
          </p>
          <CodeBlock language="bash">
{`dev-sync login --key <your-api-token>`}
          </CodeBlock>
        </Subsection>
      </Section>
    </DocsContent>
  );
}
