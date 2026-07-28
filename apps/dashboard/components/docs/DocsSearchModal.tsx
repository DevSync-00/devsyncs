"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, FileText } from "lucide-react";
import { docsNavigation } from "./DocsSidebar";

export default function DocsSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allDocs = docsNavigation.flatMap((group) => group.items);
  const filtered = query
    ? allDocs.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    : allDocs.slice(0, 5);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-full border border-glass bg-muted/30 px-4 py-1.5 font-mono text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all shadow-sm"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search documentation...</span>
        <kbd className="rounded border border-glass bg-card px-1.5 py-0.5 text-[9px] font-semibold text-foreground">⌘K</kbd>
      </button>

      {/* Modal Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-glass bg-card/95 backdrop-blur-2xl shadow-2xl space-y-3 p-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-200">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-border/60 pb-3 px-2">
              <Search className="h-4 w-4 text-primary" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a topic (e.g. cli, prisma, github action)..."
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-xs"
              />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">No documentation topics found.</div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleSelect(item.href)}
                    className="w-full flex items-center justify-between rounded-lg p-3 text-left hover:bg-primary/10 hover:text-primary transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span className="font-medium text-foreground group-hover:text-primary">{item.title}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted-foreground px-2">
              <span>Press <kbd className="rounded border bg-muted px-1">ESC</kbd> to close</span>
              <span>Dev-Sync Docs Search</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
