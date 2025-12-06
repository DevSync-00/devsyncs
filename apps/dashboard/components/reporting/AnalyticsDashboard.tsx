'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnalyticsDashboardProps {
  teamId?: string;
  period?: string;
}

interface AnalyticsMetrics {
  periodStart: string;
  periodEnd: string;
  scans: {
    total: number;
    byStatus: Record<string, number>;
    byProject: Record<string, number>;
    averageDuration: number;
    successRate: number;
  };
  migrations: {
    total: number;
    byStatus: Record<string, number>;
    byProject: Record<string, number>;
    averageDuration: number;
    successRate: number;
    rollbackRate: number;
  };
  mismatches: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byProject: Record<string, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  };
  projects: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  team?: {
    members: number;
    activeMembers: number;
    activityByMember: Record<string, number>;
  };
}

export default function AnalyticsDashboard({ teamId, period = 'month' }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  useEffect(() => {
    loadMetrics();
  }, [teamId, selectedPeriod]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
      });
      
      if (teamId) {
        params.append('teamId', teamId);
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

  const handleExport = async (format: 'json' | 'csv' | 'html') => {
    if (!metrics) return;
    
    try {
      // Create a temporary report config for export
      const reportConfig = {
        id: `export-${Date.now()}`,
        name: `Analytics Export - ${selectedPeriod}`,
        type: 'scan_summary' as const,
        format: format as any,
        period: selectedPeriod as any,
        includeMetrics: true,
        includeTrends: false,
        includeCharts: false,
        teamId: teamId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch('/api/reporting/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: reportConfig.id,
          format,
          includeCharts: false,
          includeRawData: true,
          fileName: `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting:', error);
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
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('html')}>
            <Download className="w-4 h-4 mr-2" />
            Export HTML
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-card border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Scans</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{metrics.scans.total}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics.scans.successRate.toFixed(1)}% success rate
          </p>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Migrations</span>
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{metrics.migrations.total}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics.migrations.successRate.toFixed(1)}% success rate
          </p>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Mismatches</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{metrics.mismatches.total}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics.mismatches.resolutionRate.toFixed(1)}% resolved
          </p>
        </div>

        <div className="p-6 bg-card border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Active Projects</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{metrics.projects.active}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {metrics.projects.total} total projects
          </p>
        </div>
      </div>

      {/* Team Metrics */}
      {metrics.team && (
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Team Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">{metrics.team.members}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-2xl font-bold">{metrics.team.activeMembers}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scans by Status */}
        <div className="p-6 bg-card border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Scans by Status</h3>
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
        </div>

        {/* Migrations by Status */}
        <div className="p-6 bg-card border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Migrations by Status</h3>
          <div className="space-y-2">
            {Object.keys(metrics.migrations.byStatus).length > 0 ? (
              Object.entries(metrics.migrations.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="capitalize">{status}</span>
                  <span className="font-medium">{count as number}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No migrations data available</p>
            )}
          </div>
        </div>

        {/* Mismatches by Type */}
        <div className="p-6 bg-card border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Mismatches by Type</h3>
          <div className="space-y-2">
            {Object.keys(metrics.mismatches.byType).length > 0 ? (
              Object.entries(metrics.mismatches.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-medium">{count as number}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No mismatches data available</p>
            )}
          </div>
        </div>

        {/* Mismatches by Severity */}
        <div className="p-6 bg-card border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Mismatches by Severity</h3>
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
        </div>
      </div>
    </div>
  );
}

