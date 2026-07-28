"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Terminal,
  Code2,
  Database,
  GitBranch,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  FileCode2,
  Workflow,
  CheckCircle2,
} from "lucide-react";

export interface NavGroup {
  title: string;
  items: {
    title: string;
    href: string;
    icon?: any;
    badge?: string;
  }[];
}

export const docsNavigation: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Documentation Hub", href: "/docs", icon: BookOpen },
      { title: "How DevSync Works", href: "/docs/how-devsync-works", icon: Sparkles },
      { title: "User Guide & Quickstart", href: "/docs/user-guide", icon: CheckCircle2 },
    ],
  },
  {
    title: "CLI & Integrations",
    items: [
      { title: "@devsync/cli Reference", href: "/docs/cli-reference", icon: Terminal, badge: "v0.2" },
      { title: "GitHub Actions CI/CD", href: "/docs/github-actions", icon: Workflow },
      { title: "VS Code Extension", href: "/docs/vscode-extension", icon: Code2 },
    ],
  },
  {
    title: "Supported Stack & Safety",
    items: [
      { title: "Supported ORMs & Drivers", href: "/docs/supported-frameworks", icon: Database },
      { title: "Migration Execution & Preflights", href: "/docs/migration-execution", icon: GitBranch },
      { title: "Migration History & Audits", href: "/docs/migration-history", icon: FileCode2 },
    ],
  },
  {
    title: "Reference & Support",
    items: [
      { title: "REST API Reference", href: "/docs/api-reference", icon: Code2 },
      { title: "Production Best Practices", href: "/docs/best-practices", icon: ShieldCheck },
      { title: "Troubleshooting & Error Codes", href: "/docs/troubleshooting", icon: HelpCircle },
    ],
  },
];

export default function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 space-y-8 font-mono text-xs sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
      {docsNavigation.map((group) => (
        <div key={group.title} className="space-y-3">
          <h4 className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {group.title}
          </h4>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />}
                    <span className="truncate">{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
