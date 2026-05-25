import Link from 'next/link';
import { Book, FileText, Code, HelpCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocumentationPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Documentation</h1>
        <p className="text-xl text-muted-foreground">
          Everything you need to know about using Dev-Sync.dev
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
        {/* Getting Started */}
        <Link
          href="/docs/user-guide"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <Book className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">User Guide</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Complete guide to using the Dev-Sync.dev dashboard. Perfect for new users.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Migration Execution */}
        <Link
          href="/docs/migration-execution"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Migration Execution</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Learn how to apply migrations directly from the dashboard with safety checks.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>Read guide</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Migration History */}
        <Link
          href="/docs/migration-history"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Migration History</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Track and monitor all migration executions with complete audit trail.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>Read guide</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* API Reference */}
        <Link
          href="/docs/api-reference"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">API Reference</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Complete API endpoint documentation with request/response examples.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>View API docs</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Best Practices */}
        <Link
          href="/docs/best-practices"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Best Practices</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Best practices for using Dev-Sync.dev effectively and safely.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>Read guide</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Troubleshooting */}
        <Link
          href="/docs/troubleshooting"
          className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Troubleshooting</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Common issues and solutions. Debug errors and fix problems quickly.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
            <span>Get help</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mt-12 p-6 bg-card border border-border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium mb-2">Getting Started</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/docs/user-guide#getting-started" className="hover:text-primary">
                  → First Steps
                </Link>
              </li>
              <li>
                <Link href="/docs/user-guide#creating-projects" className="hover:text-primary">
                  → Creating Projects
                </Link>
              </li>
              <li>
                <Link href="/docs/user-guide#running-scans" className="hover:text-primary">
                  → Running Scans
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Common Tasks</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/docs/migration-execution" className="hover:text-primary">
                  → Apply Migrations
                </Link>
              </li>
              <li>
                <Link href="/docs/migration-history" className="hover:text-primary">
                  → View History
                </Link>
              </li>
              <li>
                <Link href="/docs/troubleshooting" className="hover:text-primary">
                  → Fix Errors
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

