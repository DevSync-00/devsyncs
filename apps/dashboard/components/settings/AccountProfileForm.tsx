'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AccountProfileFormProps {
  userId: string;
  email: string;
  initialName: string;
}

export default function AccountProfileForm({ userId, email, initialName }: AccountProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const fullName = name.trim();
    if (fullName.length > 100) {
      setError('Name must be 100 characters or fewer.');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      full_name: fullName || null,
    });
    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName || null },
    });
    if (authError) {
      setError(authError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
  };

  return (
    <form onSubmit={saveProfile} className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{name.trim() || email}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full-name">Display name</Label>
          <Input
            id="full-name"
            value={name}
            maxLength={100}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" value={email} disabled />
          <p className="text-xs text-muted-foreground">Managed by your sign-in provider.</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {saved && (
        <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" role="status">
          <CheckCircle2 className="h-4 w-4" /> Profile updated.
        </p>
      )}

      <Button type="submit" size="sm" disabled={saving || name === initialName}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save profile
      </Button>
    </form>
  );
}
