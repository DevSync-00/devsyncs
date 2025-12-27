'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, TrendingDown, Minus, FileText, Download, 
  AlertTriangle, CheckCircle, BarChart3, Users, Zap, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TrendChart from './TrendChart';

interface EnhancedAnalyticsDashboardProps {
  teamId?: string;
  period?: string;
  projectId?: string;
}

interface EnhancedAnalyticsMetrics {
  periodStart: string;
  periodEnd: string;
  scans: any;
  migrations: any;
  mismatches: any;
  projects: any;
  team?: any;
  drift?: {
    trends: any[];
    frequentlyChanging: any[];
  };
  stability?: {
    current: any;
    history: any[];
  };
  migrationMetrics?: {
    stats: any;
    correlation: any;
  };
  collaboration?: {
    metrics: any;
    patterns: any;
  };
}

export default function EnhancedAnalyticsDashboard({ 
  teamId, 
  period = 'month',
  projectId 
}: EnhancedAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<EnhancedAnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  useEffect(() => {
    loadMetrics();
  }, [teamId, selectedPeriod, projectId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
      });
      
      if (teamId) {
        params.append('teamId', teamId);
      }
      if (projectId) {
        params.append('projectIds', projectId);
      }

      const response = await fetch(`/api/reporting/analytics?${params}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['day', 'week', 'month', 'quarter', 'year'].map((p) => (
            <Button
              key={p}
              variant={selectedPeriod === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Schema Stability Score */}
      {metrics.stability?.current && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Schema Stability Score
            </CardTitle>
            <CardDescription>
              Overall health indicator based on drift velocity, migration failures, and breaking changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold" style={{
                  color: getStabilityColor(metrics.stability.current.score)
                }}>
                  {metrics.stability.current.score}
                </div>
                <div className="text-sm text-muted-foreground mt-1">/ 100</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <TrendIcon trend={metrics.stability.current.trend} />
                  <span className="capitalize">{metrics.stability.current.trend}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Drift Velocity:</span>
                    <span className="font-medium">{metrics.stability.current.factors.driftVelocity.toFixed(1)} changes/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Migration Failure Rate:</span>
                    <span className="font-medium">{metrics.stability.current.factors.migrationFailureRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Breaking Changes:</span>
                    <span className="font-medium">{metrics.stability.current.factors.breakingChangeCount}</span>
                  </div>
                </div>
              </div>
            </div>
            {metrics.stability.history && metrics.stability.history.length > 0 && (
              <div className="mt-6">
                <TrendChart
                  data={metrics.stability.history.map((h: any) => ({
                    date: h.date,
                    value: h.score,
                  }))}
                  title="Stability Score Trend"
                  color="#3b82f6"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.scans.total}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.scans.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Migrations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.migrations.total}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.migrations.successRate.toFixed(1)}% success rate
            </p>
            {metrics.migrationMetrics?.stats && (
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.migrationMetrics.stats.repeatFailures} repeat failures
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mismatches</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.mismatches.total}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.mismatches.resolutionRate.toFixed(1)}% resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.projects.active}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.projects.total} total projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schema Drift Analytics */}
      {metrics.drift && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Schema Drift Trends</CardTitle>
              <CardDescription>Track schema changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.drift.trends && metrics.drift.trends.length > 0 ? (
                <TrendChart
                  data={metrics.drift.trends.map((t: any) => ({
                    date: t.date,
                    value: t.totalChanges,
                  }))}
                  title="Drift Velocity"
                  color="#ef4444"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No drift data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequently Changing Objects</CardTitle>
              <CardDescription>Tables and columns that change often</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.drift.frequentlyChanging && metrics.drift.frequentlyChanging.length > 0 ? (
                <div className="space-y-3">
                  {metrics.drift.frequentlyChanging.slice(0, 5).map((obj: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{obj.objectName}</div>
                        <div className="text-xs text-muted-foreground">{obj.objectType}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{obj.changeCount} changes</span>
                        <RiskBadge level={obj.riskLevel} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No frequently changing objects</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Migration Metrics */}
      {metrics.migrationMetrics?.stats && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Performance</CardTitle>
            <CardDescription>Success rates, duration, and complexity analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Average Duration</div>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.migrationMetrics.stats.averageDuration)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Average Complexity</div>
                <div className="text-2xl font-bold">
                  {metrics.migrationMetrics.stats.averageComplexity.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Repeat Failures</div>
                <div className="text-2xl font-bold text-red-500">
                  {metrics.migrationMetrics.stats.repeatFailures}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Flaky Migrations</div>
                <div className="text-2xl font-bold text-yellow-500">
                  {metrics.migrationMetrics.stats.flakyMigrations.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Collaboration */}
      {metrics.collaboration?.metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Collaboration
            </CardTitle>
            <CardDescription>Activity metrics and collaboration patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Total Members</div>
                <div className="text-2xl font-bold">{metrics.collaboration.metrics.totalMembers}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Active Members</div>
                <div className="text-2xl font-bold">{metrics.collaboration.metrics.activeMembers}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Activity</div>
                <div className="text-2xl font-bold">{metrics.collaboration.metrics.totalActivity}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bottlenecks</div>
                <div className="text-2xl font-bold text-yellow-500">
                  {metrics.collaboration.metrics.bottlenecks.length}
                </div>
              </div>
            </div>
            {metrics.collaboration.metrics.bottlenecks.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-sm font-medium mb-2">Low Activity Members:</div>
                <div className="text-sm text-muted-foreground">
                  {metrics.collaboration.metrics.bottlenecks.length} team member(s) have low activity levels
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scans by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(metrics.scans.byStatus).length > 0 ? (
                Object.entries(metrics.scans.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="capitalize">{status}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No scans data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mismatches by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(metrics.mismatches.bySeverity).length > 0 ? (
                Object.entries(metrics.mismatches.bySeverity).map(([severity, count]) => (
                  <div key={severity} className="flex items-center justify-between">
                    <span className="capitalize">{severity}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No severity data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'degrading':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <Minus className="w-4 h-4 text-gray-500" />;
  }
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

function getStabilityColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function handleExport(format: string) {
  // Export logic
  console.log('Exporting as', format);
}

