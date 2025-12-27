'use client';

import { useState, useEffect } from 'react';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectAnalyticsWidgetProps {
  projectId: string;
  compact?: boolean;
}

interface QuickStats {
  stabilityScore: number | null;
  stabilityTrend: 'improving' | 'stable' | 'degrading' | null;
  driftVelocity: number;
  recentFailures: number;
  lastScanDate: string | null;
}

export default function ProjectAnalyticsWidget({ projectId, compact = false }: ProjectAnalyticsWidgetProps) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [projectId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get stability score
      const stabilityRes = await fetch(`/api/analytics/stability?projectId=${projectId}&days=30`);
      const stabilityData = await stabilityRes.ok ? await stabilityRes.json() : null;

      // Get drift analytics
      const driftRes = await fetch(`/api/analytics/drift?projectId=${projectId}&days=30`);
      const driftData = await driftRes.ok ? await driftRes.json() : null;

      // Get migration stats
      const analyticsRes = await fetch(`/api/reporting/analytics?projectIds=${projectId}&period=month`);
      const analyticsData = await analyticsRes.ok ? await analyticsRes.json() : null;

      const stabilityScore = stabilityData?.current?.score || null;
      const stabilityTrend = stabilityData?.current?.trend || null;
      const driftVelocity = driftData?.trends?.[driftData.trends.length - 1]?.velocity || 0;
      const recentFailures = analyticsData?.migrationMetrics?.stats?.failureCount || 0;
      const lastScanDate = analyticsData?.scans?.total > 0 ? new Date().toISOString() : null; // Simplified

      setStats({
        stabilityScore,
        stabilityTrend,
        driftVelocity,
        recentFailures,
        lastScanDate,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schema Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-16 w-full bg-muted animate-pulse rounded" />
            <div className="h-12 w-full bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  if (compact) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {stats.stabilityScore !== null ? (
              <>
                <div className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${getStabilityColorClass(stats.stabilityScore)}`} />
                  <div>
                    <div className="text-2xl font-bold">{stats.stabilityScore}</div>
                    <div className="text-xs text-muted-foreground">Stability</div>
                  </div>
                </div>
                {stats.stabilityTrend && (
                  <TrendIcon trend={stats.stabilityTrend} />
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No stability data yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Schema Health
        </CardTitle>
        <CardDescription>Quick overview of schema stability and drift</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stats.stabilityScore !== null ? (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Stability Score</div>
                <div className="flex items-center gap-2">
                  <div className={`text-3xl font-bold ${getStabilityColorClass(stats.stabilityScore)}`}>
                    {stats.stabilityScore}
                  </div>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                  {stats.stabilityTrend && <TrendIcon trend={stats.stabilityTrend} />}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg text-sm text-muted-foreground text-center">
              Run a scan to calculate stability score
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Drift Velocity</div>
              <div className="text-lg font-semibold">
                {stats.driftVelocity.toFixed(1)} <span className="text-xs text-muted-foreground">changes/day</span>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Recent Failures</div>
              <div className={`text-lg font-semibold ${stats.recentFailures > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.recentFailures}
              </div>
            </div>
          </div>

          {stats.recentFailures > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-yellow-800 dark:text-yellow-200">
                  {stats.recentFailures} migration failure{stats.recentFailures !== 1 ? 's' : ''} in the last month
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'degrading' }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'degrading':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-500" />;
  }
}

function getStabilityColorClass(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

