import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';
import CodeBlock from '@/components/docs/CodeBlock';

export default function UserGuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/docs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documentation
          </Button>
        </Link>
      </div>

      <DocsContent
        title="User Guide"
        description="Complete guide to using the DevSync.AI dashboard for schema synchronization."
      >
        <Section title="Overview">
          <p className="text-muted-foreground leading-7">
            DevSync.AI dashboard helps you detect schema mismatches between your code and database,
            visualize differences with detailed reports, generate safe migrations automatically,
            and apply migrations directly from the dashboard.
          </p>
          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Detect Mismatches</h4>
              <p className="text-sm text-muted-foreground">
                Automatically identify differences between code schemas and database schemas.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Generate Migrations</h4>
              <p className="text-sm text-muted-foreground">
                Create SQL migration scripts automatically from detected mismatches.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Apply Safely</h4>
              <p className="text-sm text-muted-foreground">
                Validate and apply migrations with dry-run support and execution tracking.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">AI Insights</h4>
              <p className="text-sm text-muted-foreground">
                Get AI-powered explanations of migrations and risk assessments.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Getting Started">
          <Subsection title="Step 1: Sign Up / Log In">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Visit the dashboard homepage</li>
              <li>Click <strong className="text-foreground">"Get Early Access"</strong> or <strong className="text-foreground">"Sign Up"</strong></li>
              <li>Create an account with email and password</li>
              <li>Verify your email (if required)</li>
              <li>Log in to your account</li>
            </ol>
          </Subsection>

          <Subsection title="Step 2: Create a Project">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Click <strong className="text-foreground">"New Project"</strong> in the dashboard</li>
              <li>Enter project details:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li><strong className="text-foreground">Name</strong>: Your project name</li>
                  <li><strong className="text-foreground">Schema Type</strong>: Choose your schema type (Prisma, Supabase, TypeORM, etc.)</li>
                  <li><strong className="text-foreground">Database Connection</strong> (optional): Add later if needed</li>
                </ul>
              </li>
              <li>Click <strong className="text-foreground">"Create Project"</strong></li>
            </ol>
          </Subsection>

          <Subsection title="Step 3: Run a Scan">
            <p className="text-muted-foreground mb-4">
              To scan your codebase for schema mismatches, use the CLI:
            </p>
            <CodeBlock language="bash">
{`devsync scan \\
  --project-id <your-project-id> \\
  --api-url http://localhost:3000 \\
  --api-key <your-api-key>`}
            </CodeBlock>
            <p className="text-sm text-muted-foreground mt-4">
              Scan reports will appear in your project dashboard automatically.
            </p>
          </Subsection>

          <Subsection title="Step 4: View Results">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Navigate to your project</li>
              <li>Click on a scan report</li>
              <li>Review mismatches and suggested fixes</li>
              <li>Generate migrations if needed</li>
            </ol>
          </Subsection>
        </Section>

        <Section title="Core Features">
          <Subsection title="Project Management">
            <p className="text-muted-foreground mb-4">
              Create and manage your projects. Each project can have multiple scan reports and migrations.
            </p>
            <div className="space-y-3 mt-4">
              <div>
                <h4 className="font-medium mb-1">Viewing Projects</h4>
                <p className="text-sm text-muted-foreground">
                  See all your projects on the dashboard home page. Project cards show the latest
                  scan status and mismatch count with color-coded indicators.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Creating Projects</h4>
                <p className="text-sm text-muted-foreground">
                  Click the "New Project" button, fill in project details, choose your schema type,
                  and optionally add a database connection string.
                </p>
              </div>
            </div>
          </Subsection>

          <Subsection title="Scan Reports">
            <p className="text-muted-foreground mb-4">
              View detailed scan reports showing mismatches between your code and database schemas.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <h4 className="font-medium mb-1">Status Types</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong className="text-foreground">Completed</strong>: Scan finished successfully</li>
                  <li><strong className="text-foreground">Pending</strong>: Scan in progress</li>
                  <li><strong className="text-foreground">Failed</strong>: Scan encountered an error</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Mismatch Severity</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong className="text-destructive">Error</strong>: Critical differences that need fixing</li>
                  <li><strong className="text-yellow-500">Warning</strong>: Important differences to review</li>
                  <li><strong className="text-blue-500">Info</strong>: Optional differences</li>
                </ul>
              </div>
            </div>
          </Subsection>

          <Subsection title="Migration Management">
            <p className="text-muted-foreground mb-4">
              Generate and apply migrations directly from the dashboard with safety checks.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Generating Migrations</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Go to scan report with mismatches</li>
                  <li>Click "Generate Migration"</li>
                  <li>Review the generated SQL</li>
                  <li>Copy, download, or apply directly</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-2">Applying Migrations</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Click "Validate (Dry Run)" first</li>
                  <li>Review validation result</li>
                  <li>If valid, click "Apply Migration"</li>
                  <li>Confirm the action</li>
                  <li>Wait for execution to complete</li>
                  <li>Check execution result</li>
                </ol>
              </div>
            </div>
          </Subsection>
        </Section>
      </DocsContent>

      <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Back to Documentation
        </Link>
        <Link href="/docs/migration-execution" className="text-sm text-primary hover:underline">
          Next: Migration Execution Guide →
        </Link>
      </div>
    </div>
  );
}
