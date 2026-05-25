import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';
import CodeBlock from '@/components/docs/CodeBlock';

export default function MigrationExecutionPage() {
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
        title="Migration Execution Guide"
        description="Learn how to apply migrations directly from the Dev-Sync.dev dashboard with safety checks and validation."
      >
        <Section title="Quick Start">
          <Subsection title="Step 1: Generate a Migration">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Go to your project in the dashboard</li>
              <li>Navigate to a scan report with mismatches</li>
              <li>Click <strong className="text-foreground">"Generate Migration"</strong></li>
              <li>Review the generated SQL migration</li>
            </ol>
          </Subsection>

          <Subsection title="Step 2: Validate the Migration (Dry Run)">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>In the migration preview, click <strong className="text-foreground">"Validate (Dry Run)"</strong></li>
              <li>The system will validate the SQL syntax without executing</li>
              <li>Check the validation result for any errors or warnings</li>
            </ol>
            <div className="mt-4 p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Important:</strong> Always validate migrations before applying them to production databases.
              </p>
            </div>
          </Subsection>

          <Subsection title="Step 3: Apply the Migration">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Click <strong className="text-foreground">"Apply Migration"</strong></li>
              <li>Confirm the action in the dialog</li>
              <li>Wait for execution to complete</li>
              <li>View the execution result and history</li>
            </ol>
          </Subsection>
        </Section>

        <Section title="Features">
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Dry Run Validation</h4>
              <p className="text-sm text-muted-foreground">
                Validate migrations without executing. Catches syntax errors and connection issues before changes are made.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">One-Click Execution</h4>
              <p className="text-sm text-muted-foreground">
                Apply migrations with a single click after validation. All migrations run in transactions for safety.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Execution History</h4>
              <p className="text-sm text-muted-foreground">
                Track all migration executions with detailed logs, timestamps, and error messages.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-semibold mb-2">Safety Checks</h4>
              <p className="text-sm text-muted-foreground">
                Prevents duplicate execution, validates permissions, and checks database connections before execution.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Validation (Dry Run)">
          <p className="text-muted-foreground leading-7 mb-4">
            Dry run validation allows you to check migration SQL syntax and verify database connectivity
            without making any changes to your database.
          </p>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">What Dry Run Does</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Validates SQL syntax using PostgreSQL's EXPLAIN</li>
                <li>Checks for syntax errors and invalid SQL statements</li>
                <li>Verifies database connection is available</li>
                <li>Does NOT modify the database in any way</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">When to Use Dry Run</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Before applying any migration to production</li>
                <li>After generating a new migration</li>
                <li>When testing migrations in development</li>
                <li>After modifying migration SQL manually</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Applying Migrations">
          <p className="text-muted-foreground leading-7 mb-4">
            Applying a migration executes the SQL on your database. All migrations run in transactions
            to ensure atomicity—either all changes succeed or none are applied.
          </p>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Safety Checks</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Requires explicit confirmation before execution</li>
                <li>Prevents duplicate execution of the same migration</li>
                <li>Validates user permissions and database access</li>
                <li>Checks database connection before attempting execution</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Execution Process</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Migration status is set to "running"</li>
                <li>Database connection is established</li>
                <li>SQL is executed in a transaction</li>
                <li>Results are recorded in migration history</li>
                <li>Status is updated to "success" or "failed"</li>
              </ol>
            </div>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-500">
                <strong>Warning:</strong> Always backup your database before applying migrations in production.
                While migrations run in transactions, some operations may require manual intervention if they fail.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Best Practices">
          <ul className="list-disc list-inside space-y-3 text-muted-foreground leading-7">
            <li>
              <strong className="text-foreground">Always validate first</strong> - Run dry-run validation before applying any migration
            </li>
            <li>
              <strong className="text-foreground">Review SQL carefully</strong> - Understand what the migration will do before executing
            </li>
            <li>
              <strong className="text-foreground">Test in development first</strong> - Apply migrations to dev/staging environments before production
            </li>
            <li>
              <strong className="text-foreground">Keep database backups</strong> - Always backup before applying migrations to production
            </li>
            <li>
              <strong className="text-foreground">Monitor execution</strong> - Watch migration execution and check results in the history
            </li>
            <li>
              <strong className="text-foreground">Don't close the page</strong> - Keep the dashboard open while migrations are running
            </li>
          </ul>
        </Section>
      </DocsContent>

      <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
        <Link href="/docs/user-guide" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Previous: User Guide
        </Link>
        <Link href="/docs/migration-history" className="text-sm text-primary hover:underline">
          Next: Migration History →
        </Link>
      </div>
    </div>
  );
}
