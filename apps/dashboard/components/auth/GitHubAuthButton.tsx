'use client';

import { useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { getAuthCallbackUrl } from '@/lib/auth/callback-url';

interface GitHubAuthButtonProps {
  label: string;
  onError: (message: string) => void;
}

export default function GitHubAuthButton({ label, onError }: GitHubAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGitHubAuth = async () => {
    setLoading(true);
    onError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      onError(error.message || 'Unable to continue with GitHub. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full rounded-xl bg-card/50"
      onClick={handleGitHubAuth}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Github className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
