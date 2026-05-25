import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';

export default function MigrationHistoryPage() {
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
        title="Migration History Guide"
        description="Track and monitor all migration executions in Dev-Sync.dev with complete audit trails."
      >
        <Section title="Accessing History">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
            <li>Navigate to a scan report with migrations</li>
            <li>Find the migration you want to review</li>
            <li>Click <strong className="text-foreground">"Show History"</strong> button</li>
            <li>View execution history for that migration</li>
          </ol>
        </Section>

        <Section title="Execution Types">
          <Subsection title="Apply">
            <p className="text-muted-foreground mb-4">
              Actually executes the migration on the database. Changes are permanent and affect your database schema.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-muted-foreground">Success - Migration applied successfully</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-destructive"></span>
                <span className="text-muted-foreground">Failed - Execution encountered an error</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-muted-foreground">Running - Currently executing</span>
              </div>
            </div>
          </Subsection>

          <Subsection title="Dry Run">
            <p className="text-muted-foreground mb-4">
              Validates migration without executing. Useful for testing SQL syntax and checking for errors
              before making actual changes.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-muted-foreground">Passed - Validation successful, no errors found</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-destructive"></span>
                <span className="text-muted-foreground">Failed - Validation found errors or issues</span>
              </div>
            </div>
          </Subsection>
        </Section>

        <Section title="Execution Status">
          <div className="grid gap-4 mt-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <h4 className="font-medium">Running</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Migration is currently executing. Do not close the page or interrupt the process.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <h4 className="font-medium">Success</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Execution completed successfully. All changes have been applied to the database.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-destructive"></span>
                <h4 className="font-medium">Failed</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Execution encountered an error. Check the error message in history details for more information.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <h4 className="font-medium">Cancelled</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Execution was cancelled before completion. No changes were made to the database.
              </p>
            </div>
          </div>
        </Section>

        <Section title="History Details">
          <p className="text-muted-foreground mb-4">
            Each history entry provides comprehensive information about the execution:
          </p>
          <div className="space-y-3 mt-4">
            <div>
              <h4 className="font-medium mb-1">Execution Type</h4>
              <p className="text-sm text-muted-foreground">
                Shows whether this was an Apply, Rollback, or Dry Run operation.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Status</h4>
              <p className="text-sm text-muted-foreground">
                Current execution status: Success, Failed, Running, or Cancelled.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Execution Time</h4>
              <p className="text-sm text-muted-foreground">
                How long the execution took, measured in milliseconds.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Affected Rows</h4>
              <p className="text-sm text-muted-foreground">
                Number of database rows modified by the migration (if applicable).
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Error Message</h4>
              <p className="text-sm text-muted-foreground">
                Detailed error information if the execution failed.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Timestamps</h4>
              <p className="text-sm text-muted-foreground">
                When the execution started and completed, with relative time indicators.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Auto-Refresh">
          <p className="text-muted-foreground leading-7">
            History automatically refreshes every 2 seconds when there's a "Running" migration.
            This provides real-time execution progress and updates without manual page refreshes.
          </p>
          <div className="p-4 bg-card border border-border rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> The auto-refresh feature ensures you always
              see the latest execution status without needing to manually refresh the page.
            </p>
          </div>
        </Section>
      </DocsContent>

      <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
        <Link href="/docs/migration-execution" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Previous: Migration Execution
        </Link>
        <Link href="/docs" className="text-sm text-primary hover:underline">
          Back to Documentation
        </Link>
      </div>
    </div>
  );
}
