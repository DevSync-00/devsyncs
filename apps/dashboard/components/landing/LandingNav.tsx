"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Activity } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#integrations", label: "Integrations" },
  { href: "#safety", label: "Safety" },
  { href: "/docs", label: "Docs" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo variant="original" width={25} height={25} />
          <span className="font-mono text-sm font-semibold">dev-sync</span>
          <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">v0.1</span>
        </Link>
        <nav className="ml-10 hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <div className="mr-2 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
            <Activity className="h-3 w-3 text-emerald-400" /> All systems operational
          </div>
          <ThemeToggle />
          <Link href="/docs" className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Quickstart</Link>
          <Link href="/auth/login" className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Sign in</Link>
          <Link href="/auth/signup" className="rounded-md bg-primary px-3 py-2 font-mono text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Start scanning
          </Link>
        </div>
        <button className="ml-auto rounded-md border p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-card p-4 md:hidden">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              {link.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <Link href="/auth/login" className="rounded border px-3 py-2 text-center text-xs">Sign in</Link>
            <Link href="/auth/signup" className="rounded bg-primary px-3 py-2 text-center text-xs text-primary-foreground">Start scanning</Link>
          </div>
        </div>
      )}
    </header>
  );
}
