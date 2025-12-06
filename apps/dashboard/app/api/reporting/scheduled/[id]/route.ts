import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/reporting/scheduled/[id]
 * Update a scheduled report
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get scheduled report
    const { data: scheduledReport, error: fetchError } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !scheduledReport) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Check access
    if (scheduledReport.user_id !== user.id) {
      if (scheduledReport.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', scheduledReport.team_id)
          .eq('user_id', user.id)
          .single();

        if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.frequency) updates.frequency = body.frequency;
    if (body.scheduleTime) updates.schedule_time = body.scheduleTime;
    if (body.scheduleDay !== undefined) updates.schedule_day = body.scheduleDay;
    if (body.recipients) updates.recipients = body.recipients;
    if (body.config) updates.config = body.config;

    // Recalculate next run if schedule changed
    if (body.frequency || body.scheduleTime || body.scheduleDay !== undefined) {
      const frequency = body.frequency || scheduledReport.frequency;
      const scheduleTime = body.scheduleTime || scheduledReport.schedule_time;
      const scheduleDay = body.scheduleDay !== undefined ? body.scheduleDay : scheduledReport.schedule_day;

      const [hours, minutes] = scheduleTime.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      if (nextRun <= new Date()) {
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

      updates.next_run_at = nextRun.toISOString();
    }

    const { data: updated, error } = await supabase
      .from('scheduled_reports')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating scheduled report:', error);
      return NextResponse.json(
        { error: 'Failed to update scheduled report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledReport: updated });
  } catch (error) {
    console.error('Update scheduled report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reporting/scheduled/[id]
 * Delete a scheduled report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get scheduled report
    const { data: scheduledReport, error: fetchError } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !scheduledReport) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Check access
    if (scheduledReport.user_id !== user.id) {
      if (scheduledReport.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', scheduledReport.team_id)
          .eq('user_id', user.id)
          .single();

        if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting scheduled report:', error);
      return NextResponse.json(
        { error: 'Failed to delete scheduled report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

