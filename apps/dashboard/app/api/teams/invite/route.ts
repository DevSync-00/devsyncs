import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { teamId, email, role } = await request.json();

    if (!teamId || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, email, role' },
        { status: 400 }
      );
    }

    // Check if user is admin or owner of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Team not found or you do not have access' },
        { status: 403 }
      );
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can invite members' },
        { status: 403 }
      );
    }

    // Look up user by email
    // Note: This requires admin access or a custom function
    // For now, we'll return an error suggesting manual user ID lookup
    return NextResponse.json(
      { 
        error: 'User lookup by email requires admin API access',
        message: 'Please use the Supabase Admin API or provide user ID directly',
        hint: 'In production, implement user lookup via Supabase Admin API or create invitation tokens'
      },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('Team invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

