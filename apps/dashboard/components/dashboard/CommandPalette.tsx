'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  FolderKanban,
  Key,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';

const commands = [
  { label: 'Projects', hint: 'View all projects', href: '/dashboard', icon: FolderKanban },
  { label: 'New project', hint: 'Connect a codebase', href: '/dashboard/projects/new', icon: Plus },
  { label: 'Teams', hint: 'Manage team workspaces', href: '/dashboard/teams', icon: Users },
  { label: 'New team', hint: 'Create a shared workspace', href: '/dashboard/teams/new', icon: Plus },
  { label: 'Analytics', hint: 'Explore drift and stability trends', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'API keys', hint: 'Manage developer access', href: '/dashboard/api-keys', icon: Key },
  { label: 'Settings', hint: 'Account and AI preferences', href: '/dashboard/settings', icon: Settings },
  { label: 'Documentation', hint: 'Guides, CLI, and API reference', href: '/docs', icon: BookOpen },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint}`.toLowerCase().includes(needle),
    );
  }, [query]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        Jump to...
        <kbd className="ml-3 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-background/70 px-4 pt-[15vh] backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && results[0]) navigate(results[0].href);
                }}
                placeholder="Search projects, teams, settings, docs..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {results.map((command) => (
                <button
                  key={command.href}
                  onClick={() => navigate(command.href)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <div className="rounded-lg border bg-background p-2">
                    <command.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{command.label}</div>
                    <div className="text-xs text-muted-foreground">{command.hint}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">↵</span>
                </button>
              ))}
              {!results.length && (
                <div className="py-10 text-center text-sm text-muted-foreground">No commands found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
