'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function NewTeamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name,
          slug: slug || generateSlug(name),
          created_by: user.id,
        })
        .select()
        .single();

      if (teamError) {
        throw teamError;
      }

      // Add user as team owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        // Clean up team if member creation fails
        await supabase.from('teams').delete().eq('id', team.id);
        throw memberError;
      }

      router.push(`/dashboard/teams/${team.id}`);
    } catch (err: any) {
      console.error('Team creation error:', err);
      setError(err.message || 'Failed to create team');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Teams
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Create New Team</h1>
        <p className="text-muted-foreground">
          Create a team to collaborate with others on projects
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Team Name
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Awesome Team"
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Choose a name for your team
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="text-sm font-medium">
            Team Slug
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">@</span>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              placeholder="my-awesome-team"
              required
              disabled={loading}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            URL-friendly identifier (auto-generated from name)
          </p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={loading || !name || !slug}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Team'
            )}
          </Button>
          <Link href="/dashboard/teams">
            <Button type="button" variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

