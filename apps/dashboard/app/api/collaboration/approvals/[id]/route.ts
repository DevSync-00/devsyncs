import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/collaboration/approvals/[id]
 * Approve or reject a migration
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
    const { approved, comment, stepId } = body;

    if (approved === undefined) {
      return NextResponse.json(
        { error: 'approved is required' },
        { status: 400 }
      );
    }

    // Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('approval_workflows')
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

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Approval workflow not found' },
        { status: 404 }
      );
    }

    // Get approval step
    const { data: step, error: stepError } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('workflow_id', params.id)
      .eq('approver_id', user.id)
      .eq('id', stepId || '')
      .single();

    if (stepError || !step) {
      return NextResponse.json(
        { error: 'Approval step not found or you are not an approver' },
        { status: 404 }
      );
    }

    if (step.status !== 'pending') {
      return NextResponse.json(
        { error: 'This approval step has already been processed' },
        { status: 400 }
      );
    }

    // Update approval step
    const { error: updateStepError } = await supabase
      .from('approval_steps')
      .update({
        status: approved ? 'approved' : 'rejected',
        comment: comment || null,
        actioned_at: new Date().toISOString(),
      })
      .eq('id', step.id);

    if (updateStepError) {
      console.error('Error updating step:', updateStepError);
      return NextResponse.json(
        { error: 'Failed to update approval step' },
        { status: 500 }
      );
    }

    // Update workflow
    const newStatus = approved ? 'approved' : 'rejected';
    const newCurrentApprovals = approved 
      ? workflow.current_approvals + 1 
      : workflow.current_approvals;

    const workflowStatus = approved && newCurrentApprovals >= workflow.required_approvals
      ? 'approved'
      : !approved
      ? 'rejected'
      : 'pending';

    const { error: updateWorkflowError } = await supabase
      .from('approval_workflows')
      .update({
        status: workflowStatus,
        current_approvals: newCurrentApprovals,
        updated_at: new Date().toISOString(),
        completed_at: workflowStatus !== 'pending' ? new Date().toISOString() : null,
      })
      .eq('id', params.id);

    if (updateWorkflowError) {
      console.error('Error updating workflow:', updateWorkflowError);
      return NextResponse.json(
        { error: 'Failed to update approval workflow' },
        { status: 500 }
      );
    }

    const migration = workflow.migration as any;
    const scanReport = migration.scan_reports as any;
    const project = scanReport.projects as any;

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: approved ? 'approval_granted' : 'approval_rejected',
      actor_id: user.id,
      target_type: 'migration',
      target_id: migration.id,
      description: `${approved ? 'Approved' : 'Rejected'} migration`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    // Create notification for migration creator
    if (project.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: project.user_id,
        type: approved ? 'approval_granted' : 'approval_rejected',
        title: `Migration ${approved ? 'Approved' : 'Rejected'}`,
        message: `Your migration has been ${approved ? 'approved' : 'rejected'}`,
        data: { migrationId: migration.id, workflowId: params.id },
        read: false,
      });
    }

    return NextResponse.json({ 
      workflow: {
        ...workflow,
        status: workflowStatus,
        current_approvals: newCurrentApprovals,
      }
    });
  } catch (error) {
    console.error('Approve/reject error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

