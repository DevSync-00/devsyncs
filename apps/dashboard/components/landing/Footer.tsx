import Link from "next/link";
import { Activity, ShieldCheck, Terminal } from "lucide-react";
import Logo from "@/components/Logo";

const footerSections = [
  {
    title: "Product",
    links: [
      { href: "#product", label: "Schema Drift Detection" },
      { href: "#workflow", label: "Migration Preflight Checks" },
      { href: "/docs/supported-frameworks", label: "Supported ORMs & Drivers" },
      { href: "#safety", label: "Ephemeral Database Branching" },
      { href: "/docs/how-devsync-works", label: "Engine Architecture" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/cli-reference", label: "CLI Command Reference" },
      { href: "/docs/github-actions", label: "GitHub Action CI/CD" },
      { href: "/docs/vscode-extension", label: "VS Code Extension" },
      { href: "https://github.com/DevSync-00/devsyncs", label: "GitHub Repository" },
      { href: "/docs", label: "Documentation Hub" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/api-reference", label: "API Reference" },
      { href: "/docs/troubleshooting", label: "Troubleshooting Guide" },
      { href: "/docs/best-practices", label: "Production Best Practices" },
      { href: "/docs/how-devsync-works", label: "How DevSync Works" },
    ],
  },
  {
    title: "Company & Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Security Whitepaper" },
      { href: "/terms", label: "SOC2 Type II Info" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-glass bg-card/60 text-muted-foreground backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
        {/* Top Grid: Brand Statement & Multi-Column Navigation */}
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2.6fr]">
          {/* Brand Info & Mission Statement */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <Logo variant="original" width={26} height={26} />
              <span className="font-mono text-base font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                dev-sync
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-sm">
              Continuous database integration and schema drift prevention built for modern developer workflows. Read-only by default.
            </p>

            <div className="pt-2 flex items-center gap-3 font-mono text-xs">
              <div className="flex items-center gap-1.5 rounded-full border border-glass bg-muted/40 px-3.5 py-1.5 text-[11px]">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span className="text-foreground">$ npx dev-sync scan</span>
              </div>
            </div>
          </div>

          {/* Nav Link Categories */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {footerSections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h4 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                  {section.title}
                </h4>
                <ul className="space-y-2 font-mono text-[11px]">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Utility Bar */}
        <div className="mt-14 flex flex-col gap-4 border-t border-border/60 pt-6 font-mono text-[10px] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-muted-foreground/80">
            <span suppressHydrationWarning>© {new Date().getFullYear()} Dev-Sync.dev</span>
            <span className="hidden sm:inline">·</span>

          </div>

          <div className="flex items-center gap-3 text-muted-foreground/80">
            <span className="flex items-center gap-1 rounded border border-glass bg-muted/30 px-2.5 py-1 text-[9px]">
              <ShieldCheck className="h-3 w-3 text-primary" /> Read-only safety active
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
