import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';
import CodeBlock from '@/components/docs/CodeBlock';

export default function TroubleshootingPage() {
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
        title="Troubleshooting Guide"
        description="Common issues and solutions for Dev-Sync.dev Dashboard."
      >
        <Section title="Common Issues">
          <Subsection title="500 Error When Creating Project">
            <p className="text-muted-foreground mb-4">
              If you encounter a <code className="px-1.5 py-0.5 bg-card border border-border rounded text-sm">500 Internal Server Error</code> when trying to create a project:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-7">
              <li>Check the browser console for detailed error messages</li>
              <li>Verify that database migrations have been run in Supabase SQL Editor</li>
              <li>Check that Row Level Security (RLS) policies are set up correctly</li>
              <li>Ensure the <code className="px-1.5 py-0.5 bg-card border border-border rounded text-xs">schema_type</code> constraint matches your selection</li>
              <li>Review the error code and message in the console</li>
            </ol>
            <div className="p-4 bg-card border border-border rounded-lg mt-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Common causes:</strong> Missing database migrations,
                incorrect RLS policies, or constraint violations.
              </p>
            </div>
          </Subsection>

          <Subsection title="Migration Validation Fails">
            <p className="text-muted-foreground mb-4">
              If migration validation fails:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-7">
              <li>Check SQL syntax for errors</li>
              <li>Verify database connection string is correct</li>
              <li>Review the validation error message for details</li>
              <li>Test the SQL manually in your database client</li>
              <li>Ensure database user has necessary permissions</li>
            </ul>
          </Subsection>

          <Subsection title="Migration Execution Fails">
            <p className="text-muted-foreground mb-4">
              If migration execution fails:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-7">
              <li>Check the error message in migration history</li>
              <li>Verify database user has execute permissions</li>
              <li>Check database connection string</li>
              <li>Review SQL for syntax or logic errors</li>
              <li>Ensure database is not locked or in maintenance mode</li>
            </ul>
          </Subsection>

          <Subsection title="Can't See Scan Reports">
            <p className="text-muted-foreground mb-4">
              If scan reports don't appear:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-7">
              <li>Verify project ID is correct in CLI scan command</li>
              <li>Check that CLI sync was successful</li>
              <li>Refresh the dashboard page</li>
              <li>Verify API connection and authentication</li>
              <li>Check browser console for API errors</li>
            </ul>
          </Subsection>
        </Section>

        <Section title="Error Codes">
          <p className="text-muted-foreground mb-4">
            Understanding error codes can help diagnose issues:
          </p>
          <div className="space-y-3 mt-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-medium mb-2">23514 - Check Constraint Violation</h4>
              <p className="text-sm text-muted-foreground">
                The value provided doesn't match a required constraint. Check that schema_type
                and other required fields match allowed values.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-medium mb-2">42501 - Insufficient Privilege (RLS)</h4>
              <p className="text-sm text-muted-foreground">
                Row Level Security policy prevents the operation. Verify RLS policies are
                configured correctly for your user.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-medium mb-2">23505 - Unique Violation</h4>
              <p className="text-sm text-muted-foreground">
                The value already exists (e.g., project slug). Use a unique name or slug.
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-medium mb-2">23503 - Foreign Key Violation</h4>
              <p className="text-sm text-muted-foreground">
                Referenced record doesn't exist. Check that related records exist before
                creating dependent records.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Getting Help">
          <p className="text-muted-foreground mb-4">
            If you're still experiencing issues:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-7">
            <li>Check the documentation for detailed guides</li>
            <li>Review the troubleshooting guide for common solutions</li>
            <li>Check browser console and network tabs for errors</li>
            <li>Review migration history for execution errors</li>
            <li>Contact support with error codes and messages</li>
          </ul>
          <div className="p-4 bg-card border border-border rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">When reporting issues:</strong> Include error codes,
              messages from the console, and steps to reproduce the problem.
            </p>
          </div>
        </Section>
      </DocsContent>

      <div className="mt-12 pt-8 border-t border-border">
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Back to Documentation
        </Link>
      </div>
    </div>
  );
}
