import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/reporting/cicd/[id]
 * Update a CI/CD integration
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

    // Get integration
    const { data: integration, error: fetchError } = await supabase
      .from('cicd_integrations')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'CI/CD integration not found' },
        { status: 404 }
      );
    }

    // Check access
    if (integration.user_id !== user.id) {
      if (integration.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', integration.team_id)
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
    if (body.webhookUrl) updates.webhook_url = body.webhookUrl;
    if (body.events) updates.events = body.events;
    if (body.secretToken !== undefined) {
      // Only update if provided (don't overwrite with null)
      if (body.secretToken) {
        updates.secret_token = body.secretToken;
      }
    }

    const { data: updated, error } = await supabase
      .from('cicd_integrations')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating CI/CD integration:', error);
      return NextResponse.json(
        { error: 'Failed to update CI/CD integration' },
        { status: 500 }
      );
    }

    // Don't expose secret token
    const sanitized = {
      ...updated,
      secret_token: updated.secret_token ? '***' : null,
    };

    return NextResponse.json({ integration: sanitized });
  } catch (error) {
    console.error('Update CI/CD integration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reporting/cicd/[id]
 * Delete a CI/CD integration
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

    // Get integration
    const { data: integration, error: fetchError } = await supabase
      .from('cicd_integrations')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'CI/CD integration not found' },
        { status: 404 }
      );
    }

    // Check access
    if (integration.user_id !== user.id) {
      if (integration.team_id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', integration.team_id)
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
      .from('cicd_integrations')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting CI/CD integration:', error);
      return NextResponse.json(
        { error: 'Failed to delete CI/CD integration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete CI/CD integration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

