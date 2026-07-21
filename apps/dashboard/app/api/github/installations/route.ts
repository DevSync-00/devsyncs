import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('github_app_installations')
    .select('installation_id, account_login, account_type, repository_selection, github_login')
    .eq('user_id', user.id)
    .not('github_user_id', 'is', null)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ installations: data || [] });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let installationId: number;
  try {
    const body = await request.json();
    installationId = Number(body.installationId);
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return NextResponse.json({ error: 'A valid installation is required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('github_app_installations')
    .delete()
    .eq('user_id', user.id)
    .eq('installation_id', installationId)
    .select('installation_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });

  return NextResponse.json({ disconnected: true });
}
