'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Mail, UserPlus } from 'lucide-react';

export default function InviteMemberPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite member');
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Invitation error:', err);
      setError(err.message || 'Failed to invite member');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/teams/${teamId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Invite Team Member</h1>
        <p className="text-muted-foreground">
          Add a new member to your team by email
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={loading || success}
          />
          <p className="text-xs text-muted-foreground">
            Enter the email address of the user you want to invite
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="role" className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            disabled={loading || success}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Members can view and work on projects. Admins can manage members and projects.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-500 text-sm">
              Invitation sent successfully! The user will receive an email invitation.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={loading || !email || success}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
          <Link href={`/dashboard/teams/${teamId}`}>
            <Button type="button" variant="ghost" disabled={loading || success}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <h3 className="font-medium mb-2">Note</h3>
        <p className="text-sm text-muted-foreground">
          Existing DevSync users are added to the team immediately. New users receive
          an invitation link to create an account.
        </p>
      </div>
    </div>
  );
}

