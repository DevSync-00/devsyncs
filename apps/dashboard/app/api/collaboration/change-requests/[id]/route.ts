import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/collaboration/change-requests/[id]
 * Update change request status
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

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    // Get change request
    const { data: changeRequest, error: changeRequestError } = await supabase
      .from('change_requests')
      .select(`
        *,
        migration:migration_id (
          id,
          scan_reports (
            id,
            projects (
              id,
              user_id,
              team_id
            )
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (changeRequestError || !changeRequest) {
      return NextResponse.json(
        { error: 'Change request not found' },
        { status: 404 }
      );
    }

    // Check permissions (only assigned user or migration creator can update)
    const migration = changeRequest.migration as any;
    const scanReport = migration.scan_reports as any;
    const project = scanReport.projects as any;
    const isAssigned = changeRequest.assigned_to === user.id;
    const isCreator = project.user_id === user.id;

    if (!isAssigned && !isCreator) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update change request
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'accepted' || status === 'rejected' || status === 'closed') {
      updateData.closed_at = new Date().toISOString();
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('change_requests')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        requestedBy:requested_by (
          id,
          email
        ),
        assignedTo:assigned_to (
          id,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating change request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update change request' },
        { status: 500 }
      );
    }

    // Create activity entry
    const activityType = status === 'accepted' 
      ? 'change_request_accepted' 
      : status === 'rejected'
      ? 'change_request_rejected'
      : 'change_request_created';

    await supabase.from('activity_feed').insert({
      type: activityType,
      actor_id: user.id,
      target_type: 'change_request',
      target_id: params.id,
      description: `Change request ${status}`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    // Create notification for requester
    if (changeRequest.requested_by !== user.id) {
      await supabase.from('notifications').insert({
        user_id: changeRequest.requested_by,
        type: activityType as any,
        title: `Change Request ${status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Updated'}`,
        message: `Your change request has been ${status}`,
        data: { changeRequestId: params.id, migrationId: migration.id },
        read: false,
      });
    }

    return NextResponse.json({ changeRequest: updatedRequest });
  } catch (error) {
    console.error('Update change request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

