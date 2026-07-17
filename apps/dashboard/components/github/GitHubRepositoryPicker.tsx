'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Loader2, Lock, Globe2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  private: boolean;
  owner: string;
}

interface GitHubRepositoryPickerProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const MANUAL_VALUE = '__manual__';

export default function GitHubRepositoryPicker({
  value,
  onChange,
  disabled,
}: GitHubRepositoryPickerProps) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    fetch('/api/github/repositories')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load repositories.');
        return result;
      })
      .then((result) => setRepositories(result.repositories || []))
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedValue = useMemo(() => {
    if (manual) return MANUAL_VALUE;
    return repositories.some((repository) => repository.url === value) ? value : '';
  }, [manual, repositories, value]);

  if (loading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading authorized repositories...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Select
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.target.value;
          const useManual = nextValue === MANUAL_VALUE;
          setManual(useManual);
          onChange(useManual ? '' : nextValue);
        }}
      >
        <option value="">
          {repositories.length > 0
            ? 'Select an authorized repository...'
            : 'No authorized repositories found'}
        </option>
        {repositories.map((repository) => (
          <option key={repository.id} value={repository.url}>
            {repository.private ? 'Private' : 'Public'} - {repository.fullName}
          </option>
        ))}
        <option value={MANUAL_VALUE}>Enter a public repository URL manually</option>
      </Select>

      {manual && (
        <div className="relative">
          <GitBranch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://github.com/owner/repository"
            className="pl-9"
            disabled={disabled}
          />
        </div>
      )}

      {loadError ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : repositories.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {repositories.some((repository) => repository.url === value && repository.private) ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Globe2 className="h-3.5 w-3.5" />
          )}
          Only repositories authorized for the DevSync GitHub App are listed.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Connect GitHub or update the GitHub App repository access to populate this list.
        </p>
      )}
    </div>
  );
}
