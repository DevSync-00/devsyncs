'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Save } from 'lucide-react';

interface TeamSettingsFormProps {
  team: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function TeamSettingsForm({ team }: TeamSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState(team.name);
  const [slug, setSlug] = useState(team.slug);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(team.name)) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          name,
          slug: slug || generateSlug(name),
        })
        .eq('id', team.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err: any) {
      console.error('Team update error:', err);
      setError(err.message || 'Failed to update team');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-card border border-border rounded-lg">
      <div>
        <h2 className="text-xl font-semibold mb-4">Team Information</h2>
        
        <div className="space-y-4">
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
              The display name for your team
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
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-500 text-sm">
            Team settings updated successfully!
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading || name === team.name && slug === team.slug}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setName(team.name);
            setSlug(team.slug);
          }}
          disabled={loading}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

