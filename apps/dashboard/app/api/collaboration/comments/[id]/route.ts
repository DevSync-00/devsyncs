import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/collaboration/comments/[id]
 * Update a comment (resolve/unresolve)
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
    const { resolved } = body;

    // Get comment
    const { data: comment, error: commentError } = await supabase
      .from('mismatch_comments')
      .select('*, scan_reports(id, projects(id, user_id, team_id))')
      .eq('id', params.id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check permissions (author or project owner/team admin)
    const scanReport = comment.scan_reports as any;
    const project = scanReport.projects as any;
    const isAuthor = comment.author_id === user.id;
    const isOwner = project.user_id === user.id;

    let isTeamAdmin = false;
    if (project.team_id) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', project.team_id)
        .eq('user_id', user.id)
        .single();
      
      isTeamAdmin = membership?.role === 'admin' || membership?.role === 'owner';
    }

    if (!isAuthor && !isOwner && !isTeamAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update comment
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolved_by = user.id;
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_by = null;
        updateData.resolved_at = null;
      }
    }

    const { data: updatedComment, error: updateError } = await supabase
      .from('mismatch_comments')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        author:author_id (
          id,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: resolved ? 'comment_resolved' : 'comment_added',
      actor_id: user.id,
      target_type: 'comment',
      target_id: params.id,
      description: resolved ? 'Resolved comment' : 'Unresolved comment',
      team_id: project.team_id || null,
      project_id: project.id,
    });

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error('Update comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

