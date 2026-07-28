import Link from "next/link";
import {
  Book,
  Terminal,
  Code,
  Workflow,
  Database,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  Sparkles,
  GitBranch,
} from "lucide-react";
import CodeBlock from "@/components/docs/CodeBlock";

const categoryCards = [
  {
    title: "How DevSync Works",
    description: "Learn about AST schema normalization, drift detection pipelines, and read-only preflight execution.",
    href: "/docs/how-devsync-works",
    icon: Sparkles,
    badge: "Core Architecture",
  },
  {
    title: "User Guide & Quickstart",
    description: "Complete walk-through for setting up projects, linking codebases, and inspecting scan reports.",
    href: "/docs/user-guide",
    icon: Book,
    badge: "Getting Started",
  },
  {
    title: "@devsync/cli Reference",
    description: "Command line reference for dev-sync scan, fix, apply, init, login, and environment flags.",
    href: "/docs/cli-reference",
    icon: Terminal,
    badge: "v0.2.0 CLI",
  },
  {
    title: "GitHub Actions CI/CD",
    description: "Automate schema drift checks and migration safety rehearsals directly in your PR workflows.",
    href: "/docs/github-actions",
    icon: Workflow,
    badge: "Automation",
  },
  {
    title: "VS Code Extension",
    description: "Get inline schema diagnostics, instant warnings, and interactive ERD webviews directly in VS Code.",
    href: "/docs/vscode-extension",
    icon: Code,
    badge: "IDE Plugin",
  },
  {
    title: "Supported Stack & Drivers",
    description: "Detailed compatibility guides for Prisma, Supabase, Neon, Drizzle, TypeORM, Kysely, and Raw SQL.",
    href: "/docs/supported-frameworks",
    icon: Database,
    badge: "Drivers",
  },
  {
    title: "Migration Execution",
    description: "Apply migrations with dry-run safety validation, transaction locks, and rollback coverage.",
    href: "/docs/migration-execution",
    icon: GitBranch,
    badge: "Safety Control",
  },
  {
    title: "API Reference",
    description: "Official REST API endpoints for user projects, scan reports, and migration execution records.",
    href: "/docs/api-reference",
    icon: Code,
    badge: "REST API",
  },
  {
    title: "Troubleshooting",
    description: "Error dictionary, PostgreSQL error code resolutions, connection fixes, and RLS policy setup.",
    href: "/docs/troubleshooting",
    icon: HelpCircle,
    badge: "Support",
  },
];

export default function DocumentationPage() {
  return (
    <div className="space-y-12">
      {/* Documentation Hero Header */}
      <div className="space-y-4 pb-8 border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary font-semibold">
          Developer Documentation & API Guides
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">DevSync Platform Documentation</h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
          Everything you need to detect schema drift, validate database migrations in CI/CD, and enforce safety across Prisma, Supabase, Neon, and ORMs.
        </p>
      </div>

      {/* Quickstart Installation Block */}
      <div className="rounded-2xl border border-glass bg-card/80 p-6 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold text-foreground flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" /> Quickstart CLI Installation
          </span>
          <span className="text-muted-foreground text-[11px]">Node.js v18+ required</span>
        </div>
        <CodeBlock
          tabs={[
            { label: "npm", code: "npm install -g @devsync/cli\ndev-sync init\ndev-sync scan" },
            { label: "pnpm", code: "pnpm add -g @devsync/cli\ndev-sync init\ndev-sync scan" },
            { label: "yarn", code: "yarn global add @devsync/cli\ndev-sync init\ndev-sync scan" },
            { label: "bun", code: "bun add -g @devsync/cli\ndev-sync init\ndev-sync scan" },
          ]}
        />
      </div>

      {/* Grid Category Cards */}
      <div className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Explore Documentation Categories
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categoryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between rounded-xl border border-glass bg-card/70 p-6 backdrop-blur-xl hover:border-primary/40 hover:bg-card/90 transition-all shadow-md hover:shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-glass bg-muted px-2.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="font-mono text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <div className="pt-4 flex items-center gap-2 font-mono text-xs text-primary font-medium group-hover:gap-3 transition-all">
                  <span>Read guide</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Driver Compatibility Matrix Banner */}
      <div className="rounded-2xl border border-glass bg-card/60 p-6 backdrop-blur-xl font-mono space-y-3">
        <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Supported Schema Parsers & Driver Matrix
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {["Prisma ORM", "Supabase Postgres", "Neon Serverless", "Drizzle ORM", "TypeORM", "Kysely SQL", "Raw SQL"].map((driver) => (
            <span key={driver} className="rounded-full border border-glass bg-muted/40 px-3 py-1 text-xs text-foreground/90">
              ✓ {driver}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
