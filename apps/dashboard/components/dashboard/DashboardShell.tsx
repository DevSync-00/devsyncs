'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  BookOpen,
  Braces,
  ChevronsUpDown,
  Database,
  GitBranch,
  KeyRound,
  LogOut,
  PanelLeft,
  Settings,
  TerminalSquare,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import CommandPalette from '@/components/dashboard/CommandPalette';

const primaryNavigation = [
  { label: 'Overview', href: '/dashboard', icon: Activity, exact: true },
  { label: 'Projects', href: '/dashboard/projects', icon: Braces },
  { label: 'Scans', href: '/dashboard/scans', icon: TerminalSquare },
  { label: 'Environments', href: '/dashboard/environments', icon: Database },
];

const workspaceNavigation = [
  { label: 'Database Visualizer', href: '/dashboard/visualizer', icon: Database },
  { label: 'Teams', href: '/dashboard/teams', icon: Users },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'API keys', href: '/dashboard/api-keys', icon: KeyRound },
];


function NavItem({
  item,
  pathname,
}: {
  item: (typeof primaryNavigation)[number];
  pathname: string;
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex h-9 items-center gap-3 border-l-2 px-4 text-[13px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary/[0.08] text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <item.icon className={cn('h-4 w-4', active ? 'text-primary' : 'group-hover:text-foreground')} />
      {item.label}
    </Link>
  );
}

export default function DashboardShell({
  email,
  signOut,
  children,
}: {
  email: string;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const currentSegment = pathname === '/dashboard' 
    ? 'overview' 
    : pathname.replace('/dashboard/', '').split('/')[0] || 'overview';
  const isWorkspaceRoute = pathname === '/dashboard/visualizer';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 border-r bg-card/95 lg:flex lg:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo variant="original" width={25} height={25} />
            <span className="font-mono text-sm font-semibold tracking-tight">dev-sync</span>
            <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
              cloud
            </span>
          </Link>
        </div>

        <div className="border-b p-3">
          <button className="flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left hover:border-primary/40 transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 font-mono text-[10px] font-bold text-primary">
              DS
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">Personal workspace</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <div className="mt-2 flex items-center gap-2 px-1 font-mono text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            production
            <span className="text-border">/</span>
            main
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <div className="mb-2 px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            Workspace
          </div>
          {primaryNavigation.map((item) => <NavItem key={item.label} item={item} pathname={pathname} />)}

          <div className="mb-2 mt-6 px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            Manage
          </div>
          {workspaceNavigation.map((item) => <NavItem key={item.label} item={item} pathname={pathname} />)}
        </nav>

        <div className="border-t py-3">
          <Link href="/docs" className="flex h-9 items-center gap-3 px-4 text-[13px] text-muted-foreground hover:text-foreground">
            <BookOpen className="h-4 w-4" />
            Documentation
          </Link>
          <Link href="/dashboard/settings" className="flex h-9 items-center gap-3 px-4 text-[13px] text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <Link href="/dashboard" className="mr-3 lg:hidden" aria-label="Dashboard">
            <PanelLeft className="h-5 w-5" />
          </Link>
          <div className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex">
            <span>workspace</span>
            <span>/</span>
            <span className="text-foreground capitalize">{currentSegment}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <CommandPalette />
            <ThemeToggle />
            <Link
              href="/dashboard/settings"
              className="hidden max-w-44 truncate border-l pl-3 text-xs text-muted-foreground hover:text-foreground md:block"
            >
              {email}
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className={cn(
          'w-full',
          isWorkspaceRoute
            ? 'h-[calc(100vh-3.5rem)] overflow-hidden'
            : 'mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8',
        )}>{children}</main>
      </div>
    </div>
  );
}
