import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reporting/cicd
 * Create a CI/CD integration
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
    const { type, webhookUrl, events, secretToken, teamId } = body;

    if (!type || !webhookUrl || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'type, webhookUrl, and events are required' },
        { status: 400 }
      );
    }

    // Verify team access if teamId provided
    if (teamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const { data: integration, error } = await supabase
      .from('cicd_integrations')
      .insert({
        user_id: user.id,
        team_id: teamId || null,
        type,
        webhook_url: webhookUrl,
        secret_token: secretToken || null,
        events,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CI/CD integration:', error);
      return NextResponse.json(
        { error: 'Failed to create CI/CD integration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ integration });
  } catch (error) {
    console.error('CI/CD integration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reporting/cicd
 * Get CI/CD integrations
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
      .from('cicd_integrations')
      .select('*')
      .or(`user_id.eq.${user.id},team_id.in.(SELECT team_id FROM team_members WHERE user_id.eq.${user.id})`)
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data: integrations, error } = await query;

    if (error) {
      console.error('Error fetching CI/CD integrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CI/CD integrations' },
        { status: 500 }
      );
    }

    // Don't expose secret tokens
    const sanitized = (integrations || []).map((integration: any) => ({
      ...integration,
      secret_token: integration.secret_token ? '***' : null,
    }));

    return NextResponse.json({ integrations: sanitized });
  } catch (error) {
    console.error('Get CI/CD integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

