import Link from "next/link";
import { Activity } from "lucide-react";
import Logo from "@/components/Logo";

const links = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/api-reference", label: "API" },
  { href: "/docs/troubleshooting", label: "Troubleshooting" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function Footer() {
  return (
    <footer className="border-t bg-[#080c12] text-slate-400">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="original" width={22} height={22} />
            <span className="font-mono text-xs font-semibold text-slate-200">dev-sync</span>
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((link) => <Link key={link.href} href={link.href} className="font-mono text-[10px] hover:text-white">{link.label}</Link>)}
          </nav>
          <div className="sm:ml-auto flex items-center gap-1.5 font-mono text-[9px] text-slate-500"><Activity className="h-3 w-3 text-emerald-400" /> All systems operational</div>
        </div>
        <div className="mt-7 flex flex-col gap-2 border-t border-white/10 pt-5 font-mono text-[9px] text-slate-600 sm:flex-row sm:justify-between">
          <span suppressHydrationWarning>© {new Date().getFullYear()} Dev-Sync.dev</span>
          <span>Read-only by default · explicit approval required for writes</span>
        </div>
      </div>
    </footer>
  );
}
