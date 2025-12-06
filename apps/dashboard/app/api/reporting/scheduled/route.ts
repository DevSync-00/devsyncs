import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reporting/scheduled
 * Create a scheduled report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { config, frequency, scheduleTime, scheduleDay, recipients } = body;

    if (!config || !frequency || !scheduleTime || !recipients || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'config, frequency, scheduleTime, and recipients are required' },
        { status: 400 }
      );
    }

    // Calculate next run time
    const now = new Date();
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      // If time has passed today, schedule for next occurrence
      switch (frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          const daysUntilSchedule = scheduleDay !== undefined
            ? (scheduleDay - nextRun.getDay() + 7) % 7 || 7
            : 1;
          nextRun.setDate(nextRun.getDate() + daysUntilSchedule);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          if (scheduleDay !== undefined) {
            nextRun.setDate(scheduleDay);
          }
          break;
      }
    }

    // Create scheduled report
    const { data: scheduledReport, error } = await supabase
      .from('scheduled_reports')
      .insert({
        user_id: user.id,
        team_id: config.teamId || null,
        config: config,
        frequency,
        schedule_time: scheduleTime,
        schedule_day: scheduleDay || null,
        recipients,
        enabled: true,
        next_run_at: nextRun.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scheduled report:', error);
      return NextResponse.json(
        { error: 'Failed to create scheduled report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledReport });
  } catch (error) {
    console.error('Scheduled report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reporting/scheduled
 * Get scheduled reports
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

    const { data: scheduledReports, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .or(`user_id.eq.${user.id},team_id.in.(SELECT team_id FROM team_members WHERE user_id.eq.${user.id})`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scheduled reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled reports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledReports: scheduledReports || [] });
  } catch (error) {
    console.error('Get scheduled reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

