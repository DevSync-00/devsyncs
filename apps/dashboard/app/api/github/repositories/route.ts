import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRepositoriesForInstallation } from '@/lib/github-app';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: installations, error } = await supabase
    .from('github_app_installations')
    .select('installation_id, account_login')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const repositoryGroups = await Promise.all(
      (installations || []).map(async (installation) => {
        const repositories = await getRepositoriesForInstallation(
          Number(installation.installation_id)
        );
        return repositories.map((repository) => ({
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
          private: repository.private,
          owner: repository.owner?.login || installation.account_login,
        }));
      })
    );

    const repositories = Array.from(
      new Map(
        repositoryGroups
          .flat()
          .map((repository) => [repository.id, repository])
      ).values()
    ).sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({ repositories });
  } catch (repositoryError: any) {
    return NextResponse.json(
      {
        error: repositoryError?.message || 'Unable to load authorized GitHub repositories.',
      },
      { status: 502 }
    );
  }
}
