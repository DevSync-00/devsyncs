import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocsContent from '@/components/docs/DocsContent';
import Section from '@/components/docs/Section';
import Subsection from '@/components/docs/Subsection';
import CodeBlock from '@/components/docs/CodeBlock';

export default function APIReferencePage() {
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
        title="API Reference"
        description="Complete API reference for Dev-Sync.dev Dashboard API endpoints."
      >
        <Section title="Base URL">
          <p className="text-muted-foreground mb-4">
            All API endpoints are relative to the base URL:
          </p>
          <CodeBlock language="text">
{`http://localhost:3000/api  # Development
https://your-domain.com/api # Production`}
          </CodeBlock>
        </Section>

        <Section title="Authentication">
          <p className="text-muted-foreground mb-4 leading-7">
            All API endpoints require authentication. Two methods are supported:
          </p>
          
          <Subsection title="Session Authentication (Web)">
            <p className="text-muted-foreground mb-4">
              Uses Supabase session cookies automatically handled by the browser.
              No additional headers required when accessing from the web dashboard.
            </p>
          </Subsection>

          <Subsection title="API Key Authentication (CLI)">
            <p className="text-muted-foreground mb-4">
              Pass JWT token in the Authorization header:
            </p>
            <CodeBlock language="http">
{`Authorization: Bearer <your-jwt-token>`}
            </CodeBlock>
          </Subsection>
        </Section>

        <Section title="Endpoints">
          <Subsection title="Projects">
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-medium mb-2">GET /api/projects</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Get all projects for the authenticated user.
                </p>
                <CodeBlock language="http">
{`GET /api/projects
Authorization: Bearer <token>`}
                </CodeBlock>
              </div>
            </div>
          </Subsection>

          <Subsection title="Scan Reports">
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-medium mb-2">POST /api/scans</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Create a new scan report.
                </p>
                <CodeBlock language="http">
{`POST /api/scans
Content-Type: application/json
Authorization: Bearer <token>

{
  "project_id": "uuid",
  "status": "completed",
  "mismatches": [...]
}`}
                </CodeBlock>
              </div>
              <div>
                <h4 className="font-medium mb-2">GET /api/scans</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Get scan reports for a project.
                </p>
                <CodeBlock language="http">
{`GET /api/scans?project_id=<uuid>
Authorization: Bearer <token>`}
                </CodeBlock>
              </div>
            </div>
          </Subsection>

          <Subsection title="Migrations">
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-medium mb-2">POST /api/migrations</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Generate a migration from a scan report.
                </p>
                <CodeBlock language="http">
{`POST /api/migrations
Content-Type: application/json
Authorization: Bearer <token>

{
  "scan_report_id": "uuid"
}`}
                </CodeBlock>
              </div>
              <div>
                <h4 className="font-medium mb-2">GET /api/migrations</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Get migrations for a project or scan report.
                </p>
                <CodeBlock language="http">
{`GET /api/migrations?scan_report_id=<uuid>
Authorization: Bearer <token>`}
                </CodeBlock>
              </div>
              <div>
                <h4 className="font-medium mb-2">POST /api/migrations/[id]/execute</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Execute a migration (dry-run or actual execution).
                </p>
                <CodeBlock language="http">
{`POST /api/migrations/<id>/execute
Content-Type: application/json
Authorization: Bearer <token>

{
  "dry_run": false
}`}
                </CodeBlock>
              </div>
            </div>
          </Subsection>

          <Subsection title="AI Features">
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-medium mb-2">POST /api/ai/explain</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Generate AI explanation for a migration.
                </p>
                <CodeBlock language="http">
{`POST /api/ai/explain
Content-Type: application/json
Authorization: Bearer <token>

{
  "migration_id": "uuid"
}`}
                </CodeBlock>
              </div>
              <div>
                <h4 className="font-medium mb-2">POST /api/ai/query</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Ask AI a question about a schema.
                </p>
                <CodeBlock language="http">
{`POST /api/ai/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "question": "What's the risk of this migration?",
  "context": {...}
}`}
                </CodeBlock>
              </div>
            </div>
          </Subsection>
        </Section>

        <Section title="Error Responses">
          <p className="text-muted-foreground mb-4">
            All endpoints return errors in this format:
          </p>
          <CodeBlock language="json">
{`{
  "error": "Error message",
  "message": "User-friendly message",
  "details": {}
}`}
          </CodeBlock>
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Common Error Codes</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong className="text-foreground">401</strong>: Unauthorized - Invalid or missing authentication</li>
              <li><strong className="text-foreground">403</strong>: Forbidden - Insufficient permissions</li>
              <li><strong className="text-foreground">404</strong>: Not Found - Resource doesn't exist</li>
              <li><strong className="text-foreground">422</strong>: Unprocessable Entity - Validation error</li>
              <li><strong className="text-foreground">500</strong>: Internal Server Error - Server error</li>
            </ul>
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
