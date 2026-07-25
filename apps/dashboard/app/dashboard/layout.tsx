import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Key } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import CommandPalette from '@/components/dashboard/CommandPalette';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/auth/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <Logo variant="original" width={32} height={32} />
                <span className="font-display text-xl font-bold tracking-tight">
                  Dev-<span className="text-gradient">Sync</span>
                </span>
              </Link>
              <div className="flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Projects
                </Link>
                <Link
                  href="/dashboard/teams"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Teams
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Analytics
                </Link>
                <Link
                  href="/docs"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Documentation
                </Link>
                <Link
                  href="/dashboard/api-keys"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Key className="w-4 h-4" />
                  API Keys
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <CommandPalette />
              <ThemeToggle />
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                {user.email}
              </Link>
              <form action={handleSignOut}>
                <Button type="submit" variant="ghost" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

