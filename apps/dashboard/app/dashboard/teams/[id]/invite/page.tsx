'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Mail, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function InviteMemberPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  const supabase = createClient();
  
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // First, get the user by email to check if they exist
      // Note: This requires querying auth.users which might need admin access
      // For now, we'll create a team_member entry and handle the user lookup differently
      // In production, you'd want to use Supabase admin API or a server action

      // Check if user exists in auth.users (this requires RLS or admin access)
      // For now, we'll assume the user exists and create the membership
      // You might want to add email validation and user lookup here

      // Check if member already exists
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', email) // This won't work - need to find user by email first
        .single();

      if (existing) {
        throw new Error('User is already a member of this team');
      }

      // For now, we'll need to implement this properly with user lookup
      // This is a simplified version - in production, you'd need to:
      // 1. Look up user by email (might need admin API)
      // 2. Create team_member with the found user_id
      // 3. Send invitation email

      setError('User invitation not yet fully implemented. Please use user ID directly.');
      setLoading(false);
      
      // TODO: Implement proper user lookup and invitation
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
          User invitation requires the invited user to already have an account.
          In production, you would implement email invitations with magic links
          or use Supabase Admin API to look up users by email.
        </p>
      </div>
    </div>
  );
}

