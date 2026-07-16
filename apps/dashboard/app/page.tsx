import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import TrustStrip from "@/components/landing/TrustStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Safety from "@/components/landing/Safety";
import DeveloperExperience from "@/components/landing/DeveloperExperience";
import Integrations from "@/components/landing/Integrations";
import UseCases from "@/components/landing/UseCases";
import CallToAction from "@/components/landing/CallToAction";
import Footer from "@/components/landing/Footer";
import { Plus, FolderKanban, Clock, Activity, TrendingUp, Users } from 'lucide-react';
import { fetchUserStats } from '@/lib/db-optimizations';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import SyncAnimation from '@/components/animations/SyncAnimation';

function formatSchemaType(schemaType: string): string {
  const schemaTypeMap: Record<string, string> = {
    'prisma': 'Prisma',
    'supabase': 'Supabase',
    'typeorm': 'TypeORM',
    'kysely': 'Kysely',
    'sequelize': 'Sequelize',
    'drizzle': 'Drizzle ORM',
    'django': 'Django',
    'sqlalchemy': 'SQLAlchemy',
    'raw-sql': 'Raw SQL',
  };
  return schemaTypeMap[schemaType] || schemaType;
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is logged in, show dashboard home
  if (user) {
    // Use optimized batch fetch
    const stats = await fetchUserStats(supabase, user.id);

    const projects = stats.projects;
    const latestScans = stats.scans;

    // Create a map of project_id to latest scan (only keep latest per project)
    const scanMap = new Map();
    latestScans?.forEach(scan => {
      if (!scanMap.has(scan.project_id)) {
        scanMap.set(scan.project_id, scan);
      }
    });

    // Get recent migrations count (optimized)
    const scanReportIds = latestScans?.map(s => s.id) || [];
    const { count: migrationCount } = scanReportIds.length > 0
      ? await supabase
          .from('migrations')
          .select('*', { count: 'exact', head: true })
          .in('scan_report_id', scanReportIds)
      : { count: 0 };

    const teamCount = stats.teamsCount;

    // Calculate stats
    const totalMismatches = latestScans?.reduce((sum, scan) => {
      return sum + ((scan.mismatches as any[])?.length || 0);
    }, 0) || 0;

    const activeProjects = projects?.filter(p => {
      const scan = scanMap.get(p.id);
      return scan && scan.status === 'completed';
    }).length || 0;

    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Navigation */}
        <nav className="border-b border-border bg-card sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <Logo variant="original" width={32} height={32} />
                <span className="font-display text-xl font-bold tracking-tight">
                  DevSync<span className="text-gradient">.ai</span>
                </span>
              </Link>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link href="/docs">
                  <Button variant="ghost" size="sm">Documentation</Button>
                </Link>
                <span className="text-sm text-muted-foreground">{user.email}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-8">
          <div className="space-y-8">
            {/* Welcome Section */}
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
              <p className="text-muted-foreground text-lg">
                Here's what's happening with your projects
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-6 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <FolderKanban className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Projects</span>
                </div>
                <p className="text-3xl font-bold">{projects?.length || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeProjects} active
                </p>
              </div>
              <div className="p-6 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Mismatches</span>
                </div>
                <p className="text-3xl font-bold">{totalMismatches}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all projects
                </p>
              </div>
              <div className="p-6 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Migrations</span>
                </div>
                <p className="text-3xl font-bold">{migrationCount || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generated
                </p>
              </div>
              <div className="p-6 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Teams</span>
                </div>
                <p className="text-3xl font-bold">{teamCount || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member of
                </p>
              </div>
            </div>

            <SyncAnimation />

            {/* Recent Projects */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Recent Projects</h2>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>

              {projects && projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => {
                    const latestScan = scanMap.get(project.id);
                    const mismatchCount = (latestScan?.mismatches as any[])?.length || 0;

                    return (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <FolderKanban className="w-8 h-8 text-primary" />
                          {latestScan && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                latestScan.status === 'completed'
                                  ? mismatchCount === 0
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-yellow-500/10 text-yellow-500'
                                  : 'bg-gray-500/10 text-gray-500'
                              }`}
                            >
                              {latestScan.status}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {formatSchemaType(project.schema_type)} schema
                        </p>
                        {latestScan && (
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {new Date(latestScan.created_at).toLocaleDateString()}
                            </div>
                            {mismatchCount > 0 && (
                              <span className="text-yellow-500">
                                {mismatchCount} mismatch{mismatchCount !== 1 ? 'es' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border border-border rounded-lg bg-card">
                  <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first project to start syncing schemas
                  </p>
                  <Link href="/dashboard/projects/new">
                    <Button size="lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link href="/dashboard/projects/new">
                <div className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                  <Plus className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">New Project</h3>
                  <p className="text-sm text-muted-foreground">Create a new project</p>
                </div>
              </Link>
              <Link href="/dashboard/teams">
                <div className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                  <Users className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Teams</h3>
                  <p className="text-sm text-muted-foreground">Manage teams</p>
                </div>
              </Link>
              <Link href="/docs">
                <div className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                  <Activity className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Documentation</h3>
                  <p className="text-sm text-muted-foreground">Learn more</p>
                </div>
              </Link>
              <Link href="/dashboard">
                <div className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
                  <TrendingUp className="w-6 h-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Full dashboard</p>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If user is not logged in, show landing page
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <Safety />
        <DeveloperExperience />
        <Integrations />
        <UseCases />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
