import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collaboration/comments
 * Add a comment to a mismatch
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
    const { scanReportId, mismatchId, content, threadId, parentId } = body;

    if (!scanReportId || !mismatchId || !content) {
      return NextResponse.json(
        { error: 'scanReportId, mismatchId, and content are required' },
        { status: 400 }
      );
    }

    // Verify scan report access
    const { data: scanReport, error: scanError } = await supabase
      .from('scan_reports')
      .select('*, projects(id, user_id, team_id)')
      .eq('id', scanReportId)
      .single();

    if (scanError || !scanReport) {
      return NextResponse.json(
        { error: 'Scan report not found' },
        { status: 404 }
      );
    }

    const project = scanReport.projects as any;
    const isOwner = project.user_id === user.id;
    
    // Check team access
    let hasTeamAccess = false;
    if (project.team_id) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', project.team_id)
        .eq('user_id', user.id)
        .single();
      
      hasTeamAccess = !!membership;
    }

    // Check if shared with user
    const { data: share } = await supabase
      .from('shared_scan_results')
      .select('permissions')
      .eq('scan_report_id', scanReportId)
      .or(`shared_with.eq.${user.id},share_type.eq.public`)
      .single();

    const canComment = isOwner || hasTeamAccess || (share?.permissions as any)?.canComment;

    if (!canComment) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create comment
    const { data: comment, error: commentError } = await supabase
      .from('mismatch_comments')
      .insert({
        scan_report_id: scanReportId,
        mismatch_id: mismatchId,
        author_id: user.id,
        content,
        thread_id: threadId || null,
        parent_id: parentId || null,
        resolved: false,
      })
      .select(`
        *,
        author:author_id (
          id,
          email
        )
      `)
      .single();

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: 'comment_added',
      actor_id: user.id,
      target_type: 'comment',
      target_id: comment.id,
      description: `Added comment on mismatch`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collaboration/comments
 * Get comments for a scan report
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
    const scanReportId = searchParams.get('scanReportId');
    const mismatchId = searchParams.get('mismatchId');

    if (!scanReportId) {
      return NextResponse.json(
        { error: 'scanReportId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('mismatch_comments')
      .select(`
        *,
        author:author_id (
          id,
          email
        )
      `)
      .eq('scan_report_id', scanReportId)
      .order('created_at', { ascending: true });

    if (mismatchId) {
      query = query.eq('mismatch_id', mismatchId);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

