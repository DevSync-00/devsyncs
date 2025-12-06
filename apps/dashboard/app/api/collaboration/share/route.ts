import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collaboration/share
 * Share a scan result with a team or user
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
    const { scanReportId, shareWith, shareType, permissions, expiresAt } = body;

    if (!scanReportId || !shareWith || !shareType) {
      return NextResponse.json(
        { error: 'scanReportId, shareWith, and shareType are required' },
        { status: 400 }
      );
    }

    // Verify scan report exists and user has access
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

    if (!isOwner && !hasTeamAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Generate share token for public shares
    let shareToken: string | undefined;
    if (shareType === 'public') {
      shareToken = Buffer.from(`${scanReportId}-${Date.now()}`).toString('base64');
    }

    // Create share record
    const { data: share, error: shareError } = await supabase
      .from('shared_scan_results')
      .insert({
        scan_report_id: scanReportId,
        shared_by: user.id,
        shared_with: shareWith,
        share_type: shareType,
        share_token: shareToken,
        permissions: permissions || {
          canView: true,
          canComment: true,
          canApprove: false,
          canRequestChanges: false,
        },
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (shareError) {
      console.error('Error creating share:', shareError);
      return NextResponse.json(
        { error: 'Failed to create share' },
        { status: 500 }
      );
    }

    // Create activity entry
    await supabase.from('activity_feed').insert({
      type: 'project_shared',
      actor_id: user.id,
      target_type: 'scan',
      target_id: scanReportId,
      description: `Shared scan result with ${shareType}`,
      team_id: project.team_id || null,
      project_id: project.id,
    });

    return NextResponse.json({ share });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collaboration/share
 * Get shared scan results
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
    const teamId = searchParams.get('teamId');

    let query = supabase
      .from('shared_scan_results')
      .select('*, scan_reports(id, projects(id, name))')
      .or(`shared_with.eq.${user.id},shared_with.eq.${teamId || ''},share_type.eq.public`);

    const { data: shares, error } = await query;

    if (error) {
      console.error('Error fetching shares:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shares' },
        { status: 500 }
      );
    }

    return NextResponse.json({ shares: shares || [] });
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

