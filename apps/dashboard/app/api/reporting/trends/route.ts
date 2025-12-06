import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reporting/trends
 * Get trend analysis
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
    const metric = searchParams.get('metric') || 'scans';

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

    // Get previous period for comparison
    const previousPeriodStart = new Date(periodStart);
    const previousPeriodEnd = new Date(periodStart);
    const periodDuration = now.getTime() - periodStart.getTime();
    previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDuration);
    previousPeriodEnd.setTime(periodStart.getTime());

    // Get projects
    let projectQuery = supabase.from('projects').select('id');
    
    if (teamId) {
      projectQuery = projectQuery.eq('team_id', teamId);
    } else if (projectIds && projectIds.length > 0) {
      projectQuery = projectQuery.in('id', projectIds);
    } else {
      projectQuery = projectQuery.eq('user_id', user.id);
    }

    const { data: projects } = await projectQuery;
    const projectIdsList = projects?.map((p: any) => p.id) || [];

    // Generate data points (daily for month+, hourly for day/week)
    const dataPoints: Array<{ date: string; value: number }> = [];
    const interval = period === 'day' || period === 'week' ? 'hour' : 'day';
    const step = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    for (let date = new Date(periodStart); date <= now; date = new Date(date.getTime() + step)) {
      const nextDate = new Date(date.getTime() + step);
      
      let value = 0;
      
      if (metric === 'scans') {
        const { count } = await supabase
          .from('scan_reports')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectIdsList)
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDate.toISOString());
        
        value = count || 0;
      } else if (metric === 'migrations') {
        const scanReportIds = await supabase
          .from('scan_reports')
          .select('id')
          .in('project_id', projectIdsList);
        
        const scanIds = scanReportIds.data?.map((s: any) => s.id) || [];
        
        if (scanIds.length > 0) {
          const { count } = await supabase
            .from('migrations')
            .select('*', { count: 'exact', head: true })
            .in('scan_report_id', scanIds)
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString());
          
          value = count || 0;
        }
      } else if (metric === 'mismatches') {
        const { data: reports } = await supabase
          .from('scan_reports')
          .select('mismatches')
          .in('project_id', projectIdsList)
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDate.toISOString());
        
        value = (reports || []).reduce((sum, r: any) => {
          return sum + ((r.mismatches as any[])?.length || 0);
        }, 0);
      }
      
      dataPoints.push({
        date: date.toISOString(),
        value,
      });
    }

    // Get current and previous period totals
    let currentValue = 0;
    let previousValue = 0;

    if (metric === 'scans') {
      const { count: current } = await supabase
        .from('scan_reports')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIdsList)
        .gte('created_at', periodStart.toISOString());
      
      const { count: previous } = await supabase
        .from('scan_reports')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIdsList)
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString());
      
      currentValue = current || 0;
      previousValue = previous || 0;
    } else if (metric === 'migrations') {
      const scanReportIds = await supabase
        .from('scan_reports')
        .select('id')
        .in('project_id', projectIdsList);
      
      const scanIds = scanReportIds.data?.map((s: any) => s.id) || [];
      
      if (scanIds.length > 0) {
        const { count: current } = await supabase
          .from('migrations')
          .select('*', { count: 'exact', head: true })
          .in('scan_report_id', scanIds)
          .gte('created_at', periodStart.toISOString());
        
        const { count: previous } = await supabase
          .from('migrations')
          .select('*', { count: 'exact', head: true })
          .in('scan_report_id', scanIds)
          .gte('created_at', previousPeriodStart.toISOString())
          .lt('created_at', previousPeriodEnd.toISOString());
        
        currentValue = current || 0;
        previousValue = previous || 0;
      }
    } else if (metric === 'mismatches') {
      const { data: currentReports } = await supabase
        .from('scan_reports')
        .select('mismatches')
        .in('project_id', projectIdsList)
        .gte('created_at', periodStart.toISOString());
      
      const { data: previousReports } = await supabase
        .from('scan_reports')
        .select('mismatches')
        .in('project_id', projectIdsList)
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString());
      
      currentValue = (currentReports || []).reduce((sum, r: any) => {
        return sum + ((r.mismatches as any[])?.length || 0);
      }, 0);
      
      previousValue = (previousReports || []).reduce((sum, r: any) => {
        return sum + ((r.mismatches as any[])?.length || 0);
      }, 0);
    }

    const changePercent = previousValue > 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : currentValue > 0 ? 100 : 0;

    const trend: 'up' | 'down' | 'stable' = 
      changePercent > 5 ? 'up' :
      changePercent < -5 ? 'down' :
      'stable';

    return NextResponse.json({
      metric,
      current: currentValue,
      previous: previousValue,
      changePercent,
      trend,
      dataPoints,
    });
  } catch (error) {
    console.error('Get trends error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

