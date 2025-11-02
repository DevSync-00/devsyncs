'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteTeamButtonProps {
  teamId: string;
  teamName: string;
}

export default function DeleteTeamButton({ teamId, teamName }: DeleteTeamButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== teamName) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) {
        throw error;
      }

      router.push('/dashboard/teams');
    } catch (err: any) {
      console.error('Team deletion error:', err);
      alert(`Failed to delete team: ${err.message}`);
      setLoading(false);
      setConfirmOpen(false);
      setConfirmText('');
    }
  };

  if (!confirmOpen) {
    return (
      <Button
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete Team
      </Button>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-card border border-destructive/20 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive mb-2">
            Are you absolutely sure?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            This action cannot be undone. This will permanently delete the team
            <strong className="text-foreground"> "{teamName}"</strong> and remove
            all associated data including projects, scan reports, and migrations.
          </p>
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium block">
              Type <strong className="text-destructive">{teamName}</strong> to confirm:
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={teamName}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-destructive"
              disabled={loading}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading || confirmText !== teamName}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Team
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setConfirmOpen(false);
            setConfirmText('');
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

