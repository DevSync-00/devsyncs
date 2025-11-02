'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Shield, User, Crown, Trash2 } from 'lucide-react';

interface MemberActionsProps {
  memberId: string;
  teamId: string;
  currentRole: string;
  isCurrentUser: boolean;
  onUpdate?: () => void;
}

export default function MemberActions({
  memberId,
  teamId,
  currentRole,
  isCurrentUser,
  onUpdate,
}: MemberActionsProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      setShowRoleMenu(false);
      onUpdate?.();
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      onUpdate?.();
    } catch (err: any) {
      alert(`Failed to remove member: ${err.message}`);
      setLoading(false);
    }
  };

  if (isCurrentUser) {
    return null;
  }

  const roleOptions = [
    { value: 'member', label: 'Member', icon: User },
    { value: 'admin', label: 'Admin', icon: Shield },
    { value: 'owner', label: 'Owner', icon: Crown },
  ].filter(opt => opt.value !== currentRole || currentRole === 'owner');

  return (
    <div className="flex items-center gap-2">
      {showRoleMenu ? (
        <div className="flex items-center gap-2">
          <select
            value={currentRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={loading}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoleMenu(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoleMenu(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Role'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={loading}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

