import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reporting/analytics
 * Get analytics metrics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const teamId = searchParams.get('teamId');
    const projectIds = searchParams.get('projectIds')?.split(',').filter(Boolean);

    // Calculate period dates
    const now = new Date();
    const periodStart = new Date();
    
    switch (period) {
      case 'day':
        periodStart.setDate(now.getDate() - 1);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        periodStart.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get projects
    let projectQuery = supabase.from('projects').select('id');
    
    if (teamId) {
      projectQuery = projectQuery.eq('team_id', teamId);
    } else if (projectIds && projectIds.length > 0) {
      projectQuery = projectQuery.in('id', projectIds);
    } else {
      // User's projects
      projectQuery = projectQuery.eq('user_id', user.id);
    }

    const { data: projects } = await projectQuery;
    const projectIdsList = projects?.map((p: any) => p.id) || [];

    if (projectIdsList.length === 0) {
      return NextResponse.json({
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        scans: {
          total: 0,
          byStatus: {},
          byProject: {},
          averageDuration: 0,
          successRate: 0,
        },
        migrations: {
          total: 0,
          byStatus: {},
          byProject: {},
          averageDuration: 0,
          successRate: 0,
          rollbackRate: 0,
        },
        mismatches: {
          total: 0,
          byType: {},
          bySeverity: {},
          byProject: {},
          resolutionRate: 0,
          averageResolutionTime: 0,
        },
        projects: {
          total: 0,
          active: 0,
          byStatus: {},
        },
      });
    }

    // Get scans
    const { data: scans } = await supabase
      .from('scan_reports')
      .select('id, status, project_id, created_at, completed_at')
      .in('project_id', projectIdsList)
      .gte('created_at', periodStart.toISOString());

    const totalScans = scans?.length || 0;
    const scansByStatus = (scans || []).reduce((acc: Record<string, number>, scan: any) => {
      acc[scan.status] = (acc[scan.status] || 0) + 1;
      return acc;
    }, {});

    const scansByProject = (scans || []).reduce((acc: Record<string, number>, scan: any) => {
      acc[scan.project_id] = (acc[scan.project_id] || 0) + 1;
      return acc;
    }, {});

    const completedScans = (scans || []).filter((s: any) => s.status === 'completed');
    const averageDuration = completedScans.length > 0
      ? completedScans.reduce((sum: number, scan: any) => {
          const duration = scan.completed_at && scan.created_at
            ? new Date(scan.completed_at).getTime() - new Date(scan.created_at).getTime()
            : 0;
          return sum + duration;
        }, 0) / completedScans.length
      : 0;

    const successRate = totalScans > 0
      ? (completedScans.length / totalScans) * 100
      : 0;

    // Get migrations
    const scanReportIds = scans?.map((s: any) => s.id) || [];
    const { data: migrations } = scanReportIds.length > 0 ? await supabase
      .from('migrations')
      .select('id, applied, execution_status, scan_report_id, created_at, execution_completed_at')
      .in('scan_report_id', scanReportIds) : { data: null };

    const totalMigrations = migrations?.length || 0;
    const migrationsByStatus: Record<string, number> = {};
    (migrations || []).forEach((m: any) => {
      const status = m.applied ? 'applied' : (m.execution_status || 'pending');
      migrationsByStatus[status] = (migrationsByStatus[status] || 0) + 1;
    });

    const migrationsByProject: Record<string, number> = {};
    (migrations || []).forEach((m: any) => {
      const scan = scans?.find((s: any) => s.id === m.scan_report_id);
      if (scan) {
        migrationsByProject[scan.project_id] = (migrationsByProject[scan.project_id] || 0) + 1;
      }
    });

    const appliedMigrations = (migrations || []).filter((m: any) => m.applied);
    const averageMigrationDuration = appliedMigrations.length > 0
      ? appliedMigrations.reduce((sum: number, m: any) => {
          const duration = m.execution_completed_at && m.created_at
            ? new Date(m.execution_completed_at).getTime() - new Date(m.created_at).getTime()
            : 0;
          return sum + duration;
        }, 0) / appliedMigrations.length
      : 0;

    const migrationSuccessRate = totalMigrations > 0
      ? (appliedMigrations.length / totalMigrations) * 100
      : 0;

    // Get rollbacks (migrations that were rolled back)
    const { data: rollbacks } = scanReportIds.length > 0 ? await supabase
      .from('migrations')
      .select('id')
      .in('scan_report_id', scanReportIds)
      .eq('applied', false)
      .not('execution_status', 'is', null) : { data: null };

    const rollbackRate = totalMigrations > 0
      ? ((rollbacks?.length || 0) / totalMigrations) * 100
      : 0;

    // Get mismatches
    const { data: mismatchesData } = scanReportIds.length > 0 ? await supabase
      .from('scan_reports')
      .select('id, mismatches, project_id')
      .in('id', scanReportIds) : { data: null };

    const allMismatches: any[] = [];
    (mismatchesData || []).forEach((report: any) => {
      const mismatches = report.mismatches || [];
      mismatches.forEach((m: any) => {
        allMismatches.push({
          ...m,
          scanReportId: report.id,
          projectId: report.project_id,
        });
      });
    });

    const totalMismatches = allMismatches.length;
    const mismatchesByType = allMismatches.reduce((acc: Record<string, number>, m: any) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {});

    const mismatchesBySeverity = allMismatches.reduce((acc: Record<string, number>, m: any) => {
      acc[m.severity] = (acc[m.severity] || 0) + 1;
      return acc;
    }, {});

    const mismatchesByProject = allMismatches.reduce((acc: Record<string, number>, m: any) => {
      acc[m.projectId] = (acc[m.projectId] || 0) + 1;
      return acc;
    }, {});

    // Get resolved mismatches (from comments)
    const { data: resolvedComments } = scanReportIds.length > 0 ? await supabase
      .from('mismatch_comments')
      .select('mismatch_id')
      .in('scan_report_id', scanReportIds)
      .eq('resolved', true) : { data: null };

    const resolvedMismatchIds = new Set((resolvedComments || []).map((c: any) => c.mismatch_id));
    const resolvedMismatches = allMismatches.filter((m: any) => resolvedMismatchIds.has(m.id || m.mismatchId));
    const resolutionRate = totalMismatches > 0
      ? (resolvedMismatches.length / totalMismatches) * 100
      : 0;

    // Get team metrics if teamId provided
    let teamMetrics = undefined;
    if (teamId) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      const memberIds = members?.map((m: any) => m.user_id) || [];
      
      // Get activity by member
      const { data: activities } = await supabase
        .from('activity_feed')
        .select('actor_id')
        .eq('team_id', teamId)
        .gte('created_at', periodStart.toISOString());

      const activityByMember = (activities || []).reduce((acc: Record<string, number>, a: any) => {
        acc[a.actor_id] = (acc[a.actor_id] || 0) + 1;
        return acc;
      }, {});

      const activeMembers = Object.keys(activityByMember).length;

      teamMetrics = {
        members: memberIds.length,
        activeMembers,
        activityByMember,
      };
    }

    return NextResponse.json({
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      scans: {
        total: totalScans,
        byStatus: scansByStatus,
        byProject: scansByProject,
        averageDuration,
        successRate,
      },
      migrations: {
        total: totalMigrations,
        byStatus: migrationsByStatus,
        byProject: migrationsByProject,
        averageDuration: averageMigrationDuration,
        successRate: migrationSuccessRate,
        rollbackRate,
      },
      mismatches: {
        total: totalMismatches,
        byType: mismatchesByType,
        bySeverity: mismatchesBySeverity,
        byProject: mismatchesByProject,
        resolutionRate,
        averageResolutionTime: 0, // Would need to track resolution time
      },
      projects: {
        total: projectIdsList.length,
        active: projectIdsList.length, // Simplified
        byStatus: {},
      },
      team: teamMetrics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

