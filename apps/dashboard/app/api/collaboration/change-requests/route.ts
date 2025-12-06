import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collaboration/change-requests
 * Create a change request
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
    const { migrationId, type, title, description, suggestedChanges } = body;

    if (!migrationId || !type || !title || !description) {
      return NextResponse.json(
        { error: 'migrationId, type, title, and description are required' },
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

    // Create change request
    const { data: changeRequest, error: changeRequestError } = await supabase
      .from('change_requests')
      .insert({
        migration_id: migrationId,
        requested_by: user.id,
        type,
        title,
        description,
        suggested_changes: suggestedChanges || null,
        status: 'open',
        assigned_to: project.user_id, // Assign to migration creator
      })
      .select(`
        *,
        requestedBy:requested_by (
          id,
          email
        )
      `)
      .single();

    if (changeRequestError) {
      console.error('Error creating change request:', changeRequestError);
      return NextResponse.json(
        { error: 'Failed to create change request' },
        { status: 500 }
      );
    }

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: 'change_request_created',
      actor_id: user.id,
      target_type: 'migration',
      target_id: migrationId,
      description: `Created change request: ${title}`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    // Create notification for migration creator
    if (project.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: project.user_id,
        type: 'change_request_created',
        title: 'Change Request Created',
        message: `A change request has been created for your migration`,
        data: { migrationId, changeRequestId: changeRequest.id },
        read: false,
      });
    }

    return NextResponse.json({ changeRequest });
  } catch (error) {
    console.error('Change request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collaboration/change-requests
 * Get change requests
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
      .from('change_requests')
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
      .order('created_at', { ascending: false });

    if (migrationId) {
      query = query.eq('migration_id', migrationId);
    } else {
      // Only show change requests assigned to or created by user
      query = query.or(`assigned_to.eq.${user.id},requested_by.eq.${user.id}`);
    }

    const { data: changeRequests, error } = await query;

    if (error) {
      console.error('Error fetching change requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch change requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({ changeRequests: changeRequests || [] });
  } catch (error) {
    console.error('Get change requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

