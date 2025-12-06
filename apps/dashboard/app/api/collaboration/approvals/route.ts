import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collaboration/approvals
 * Create an approval workflow
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
    const { migrationId, approvers, requiredApprovals } = body;

    if (!migrationId || !approvers || !Array.isArray(approvers) || approvers.length === 0) {
      return NextResponse.json(
        { error: 'migrationId and approvers array are required' },
        { status: 400 }
      );
    }

    // Verify migration exists and user has access
    const { data: migration, error: migrationError } = await supabase
      .from('migrations')
      .select('*, scan_reports(id, projects(id, user_id, team_id))')
      .eq('id', migrationId)
      .single();

    if (migrationError || !migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    const scanReport = migration.scan_reports as any;
    const project = scanReport.projects as any;
    const isOwner = project.user_id === user.id;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only project owner can create approval workflows' },
        { status: 403 }
      );
    }

    // Create approval workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('approval_workflows')
      .insert({
        migration_id: migrationId,
        status: 'pending',
        required_approvals: requiredApprovals || approvers.length,
        current_approvals: 0,
      })
      .select()
      .single();

    if (workflowError) {
      console.error('Error creating workflow:', workflowError);
      return NextResponse.json(
        { error: 'Failed to create approval workflow' },
        { status: 500 }
      );
    }

    // Create approval steps
    const steps = approvers.map((approverId: string, index: number) => ({
      workflow_id: workflow.id,
      approver_id: approverId,
      status: 'pending',
      order: index,
    }));

    const { error: stepsError } = await supabase
      .from('approval_steps')
      .insert(steps);

    if (stepsError) {
      console.error('Error creating approval steps:', stepsError);
      // Clean up workflow
      await supabase.from('approval_workflows').delete().eq('id', workflow.id);
      return NextResponse.json(
        { error: 'Failed to create approval steps' },
        { status: 500 }
      );
    }

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: 'approval_requested',
      actor_id: user.id,
      target_type: 'migration',
      target_id: migrationId,
      description: `Requested approval for migration`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    // Create notifications for approvers
    for (const approverId of approvers) {
      await supabase.from('notifications').insert({
        user_id: approverId,
        type: 'approval_requested',
        title: 'Approval Requested',
        message: `You have been requested to approve a migration`,
        data: { migrationId, workflowId: workflow.id },
        read: false,
      });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Approval workflow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collaboration/approvals
 * Get approval workflows
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
    const migrationId = searchParams.get('migrationId');

    let query = supabase
      .from('approval_workflows')
      .select(`
        *,
        migration:migration_id (
          id,
          filename
        ),
        steps:approval_steps (
          *,
          approver:approver_id (
            id,
            email
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (migrationId) {
      query = query.eq('migration_id', migrationId);
    }

    const { data: workflows, error } = await query;

    if (error) {
      console.error('Error fetching workflows:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval workflows' },
        { status: 500 }
      );
    }

    return NextResponse.json({ workflows: workflows || [] });
  } catch (error) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

