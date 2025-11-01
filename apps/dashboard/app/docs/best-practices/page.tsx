import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';

export default function BestPracticesPage() {
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
        title="Best Practices Guide"
        description="Best practices for using DevSync.AI Dashboard effectively and safely."
      >
        <Section title="Migration Execution">
          <Subsection title="1. Always Validate First">
            <div className="space-y-3">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-500 mb-2">
                  <strong>Do:</strong> Run dry-run validation before applying migrations
                </p>
                <p className="text-xs text-muted-foreground">
                  Validation catches syntax errors and connection issues before execution.
                </p>
              </div>
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive mb-2">
                  <strong>Don't:</strong> Apply migrations without validating
                </p>
                <p className="text-xs text-muted-foreground">
                  Skipping validation can lead to execution failures in production.
                </p>
              </div>
            </div>
          </Subsection>

          <Subsection title="2. Review SQL Carefully">
            <p className="text-muted-foreground mb-4">
              Understand what the migration will do before executing. Review the generated SQL
              to ensure it matches your expectations and won't cause unintended side effects.
            </p>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Use AI explanations to understand
                complex migrations better and assess risks before applying.
              </p>
            </div>
          </Subsection>

          <Subsection title="3. Test in Development First">
            <p className="text-muted-foreground mb-4">
              Always test migrations in development or staging environments before applying them to production.
              This helps identify issues early and ensures your migration works as expected.
            </p>
          </Subsection>

          <Subsection title="4. Keep Database Backups">
            <p className="text-muted-foreground mb-4">
              Always backup your database before applying migrations in production. While migrations
              run in transactions, having a backup ensures you can recover if something goes wrong.
            </p>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-500">
                <strong>Warning:</strong> Some migrations cannot be rolled back. Always maintain
                up-to-date backups of your production database.
              </p>
            </div>
          </Subsection>

          <Subsection title="5. Monitor Execution">
            <p className="text-muted-foreground mb-4">
              Watch migration execution and check results. Keep the dashboard open while migrations
              are running and review execution history after completion.
            </p>
          </Subsection>
        </Section>

        <Section title="Project Management">
          <Subsection title="1. Use Descriptive Names">
            <p className="text-muted-foreground mb-4">
              Use clear, descriptive project names that indicate the purpose and scope of the project.
              This makes it easier to manage multiple projects and find what you need.
            </p>
          </Subsection>

          <Subsection title="2. Configure Schema Type Correctly">
            <p className="text-muted-foreground mb-4">
              Select the correct schema type for your project. Using the wrong schema type will cause
              scanning issues and incorrect mismatch detection.
            </p>
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm">Supported Schema Types:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Prisma</li>
                <li>Supabase</li>
                <li>TypeORM</li>
                <li>Sequelize</li>
                <li>Drizzle ORM</li>
                <li>Django</li>
                <li>SQLAlchemy</li>
                <li>Raw SQL</li>
                <li>Kysely</li>
              </ul>
            </div>
          </Subsection>

          <Subsection title="3. Keep Connection Strings Secure">
            <p className="text-muted-foreground mb-4">
              Store database connection strings securely. Never commit them to version control
              or share them publicly. Use environment variables or secure storage solutions.
            </p>
          </Subsection>
        </Section>

        <Section title="Security">
          <Subsection title="1. Use Strong Authentication">
            <p className="text-muted-foreground mb-4">
              Use strong passwords and enable two-factor authentication (2FA) if available.
              Never share accounts or credentials with other users.
            </p>
          </Subsection>

          <Subsection title="2. Manage API Keys Securely">
            <p className="text-muted-foreground mb-4">
              Store API keys securely and never commit them to version control. Use environment
              variables or secure secret management tools. Rotate keys regularly.
            </p>
          </Subsection>

          <Subsection title="3. Review Access Regularly">
            <p className="text-muted-foreground mb-4">
              Periodically review who has access to your projects. Remove access for users who
              no longer need it and ensure permissions are set appropriately.
            </p>
          </Subsection>
        </Section>

        <Section title="Workflow Recommendations">
          <div className="space-y-4">
            <div className="p-4 bg-card border border-border rounded-lg">
              <h4 className="font-medium mb-2">Recommended Workflow</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Run scan in development environment</li>
                <li>Review mismatches and generate migration</li>
                <li>Validate migration with dry-run</li>
                <li>Apply migration in development</li>
                <li>Test application thoroughly</li>
                <li>Repeat process in staging</li>
                <li>Backup production database</li>
                <li>Apply migration in production</li>
                <li>Monitor execution and verify results</li>
              </ol>
            </div>
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
