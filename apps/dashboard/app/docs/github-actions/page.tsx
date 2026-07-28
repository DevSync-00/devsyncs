import DocsContent from "@/components/docs/DocsContent";
import Section from "@/components/docs/Section";
import Subsection from "@/components/docs/Subsection";
import CodeBlock from "@/components/docs/CodeBlock";

export default function GitHubActionsPage() {
  return (
    <DocsContent
      title="GitHub Actions CI/CD Integration"
      description="Automate database drift detection and migration safety preflights directly in your GitHub Pull Requests."
      badge="Automation"
    >
      <Section title="Overview">
        <p className="text-sm text-muted-foreground leading-relaxed">
          By integrating DevSync into your GitHub Actions workflow, every pull request automatically scans your codebase schema against staging or production database topologies to catch breaking migration changes before merging.
        </p>
      </Section>

      <Section title="Workflow Configuration">
        <Subsection title="Example Workflow File">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Add the following YAML file to <code className="font-mono text-primary">.github/workflows/schema-check.yml</code>:
          </p>
          <CodeBlock language="yaml">
{`name: DevSync Schema Drift Check

on:
  pull_request:
    branches: [ main, develop ]

jobs:
  schema-check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install DevSync CLI
        run: npm install -g @devsync/cli

      - name: Run Read-Only Schema Drift Scan
        env:
          DEVSYNC_API_KEY: \${{ secrets.DEVSYNC_API_KEY }}
          DATABASE_URL: \${{ secrets.STAGING_DATABASE_URL }}
        run: |
          dev-sync scan --check --schema ./prisma/schema.prisma`}
          </CodeBlock>
        </Subsection>

        <Subsection title="Key Security Secrets">
          <div className="rounded-lg border border-glass bg-card/60 p-4 font-mono text-xs text-muted-foreground space-y-2">
            <div><strong className="text-foreground">DEVSYNC_API_KEY:</strong> API key created in your DevSync Dashboard under Settings &gt; API Keys.</div>
            <div><strong className="text-foreground">STAGING_DATABASE_URL:</strong> Read-only database connection URL.</div>
          </div>
        </Subsection>
      </Section>
    </DocsContent>
  );
}
