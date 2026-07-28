"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
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
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1240px] transition-all duration-300">
      {/* Premium Glassmorphic Pill Header */}
      <div className="flex h-16 items-center justify-between rounded-full border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 px-6 backdrop-blur-3xl backdrop-saturate-150 shadow-2xl shadow-black/10 transition-all">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo variant="original" width={26} height={26} />
          <span className="font-mono text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            dev-sync
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden items-center gap-2 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 font-mono text-xs font-medium text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Action Group */}
        <div className="hidden items-center gap-3.5 md:flex">
          <ThemeToggle />

          <Link
            href="/auth/login"
            className="rounded-full px-3.5 py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>

          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
          >
            Start scanning <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile Action Controls */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="rounded-full border border-white/20 dark:border-white/10 p-2 hover:bg-muted transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {open && (
        <div className="mt-2 rounded-3xl border border-white/20 dark:border-white/10 bg-card/95 p-5 backdrop-blur-3xl backdrop-saturate-150 shadow-2xl md:hidden space-y-3">
          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-2.5 font-mono text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
            <Link
              href="/auth/login"
              className="rounded-full border px-4 py-2.5 text-center font-mono text-xs hover:bg-muted transition-colors text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-primary px-4 py-2.5 text-center font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start scanning
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
