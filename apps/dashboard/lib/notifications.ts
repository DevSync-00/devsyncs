import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Expected tables (Postgres / Supabase SQL):
 *
 * ```sql
 * create table if not exists public.notifications (
 *   id uuid primary key default uuid_generate_v4(),
 *   user_id uuid references auth.users(id) on delete cascade,
 *   team_id uuid,
 *   type text not null,
 *   title text not null,
 *   message text,
 *   metadata jsonb default '{}'::jsonb,
 *   read_at timestamptz,
 *   email_sent_at timestamptz,
 *   created_at timestamptz default timezone('utc', now())
 * );
 *
 * create table if not exists public.notification_preferences (
 *   user_id uuid primary key references auth.users(id) on delete cascade,
 *   email_enabled boolean default true,
 *   in_app_enabled boolean default true,
 *   team_digest_enabled boolean default false,
 *   created_at timestamptz default timezone('utc', now()),
 *   updated_at timestamptz default timezone('utc', now())
 * );
 * ```
 */

export const NOTIFICATION_TYPES = [
  'scan_completed',
  'migration_applied',
  'team_invite',
  'team_activity',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRecord {
  id: string;
  user_id: string;
  team_id?: string | null;
  type: NotificationType | string;
  title: string;
  message?: string | null;
  metadata?: Record<string, any> | null;
  read_at?: string | null;
  email_sent_at?: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  teamDigestEnabled: boolean;
}

export interface CreateNotificationInput {
  userId: string;
  teamId?: string | null;
  type: NotificationType | string;
  title: string;
  message?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  emailEnabled: true,
  inAppEnabled: true,
  teamDigestEnabled: false,
};

const NOTIFICATION_FETCH_LIMIT = 20;

export async function createNotification(
  client: SupabaseClient,
  payload: CreateNotificationInput
): Promise<NotificationRecord> {
  const { data, error } = await client
    .from('notifications')
    .insert({
      user_id: payload.userId,
      team_id: payload.teamId ?? null,
      type: payload.type,
      title: payload.title,
      message: payload.message ?? null,
      metadata: payload.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (payload.sendEmail !== false) {
    const preferences = await getNotificationPreferences(client, payload.userId);
    await sendNotificationEmail(data as NotificationRecord, preferences);
  }

  return data as NotificationRecord;
}

export async function listNotifications(
  client: SupabaseClient,
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<NotificationRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? NOTIFICATION_FETCH_LIMIT, 1), 100);

  let query = client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as NotificationRecord[]) ?? [];
}

export async function countUnreadNotifications(client: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationsAsRead(
  client: SupabaseClient,
  userId: string,
  notificationIds: string[]
) {
  if (notificationIds.length === 0) return;

  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', notificationIds);

  if (error) {
    throw error;
  }
}

export async function markNotificationsAsUnread(
  client: SupabaseClient,
  userId: string,
  notificationIds: string[]
) {
  if (notificationIds.length === 0) return;

  const { error } = await client
    .from('notifications')
    .update({ read_at: null })
    .eq('user_id', userId)
    .in('id', notificationIds);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsAsRead(client: SupabaseClient, userId: string) {
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}

export async function getNotificationPreferences(
  client: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await client
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    await client
      .from('notification_preferences')
      .insert({
        user_id: userId,
        email_enabled: DEFAULT_NOTIFICATION_PREFS.emailEnabled,
        in_app_enabled: DEFAULT_NOTIFICATION_PREFS.inAppEnabled,
        team_digest_enabled: DEFAULT_NOTIFICATION_PREFS.teamDigestEnabled,
      })
      .select('*')
      .maybeSingle();

    return DEFAULT_NOTIFICATION_PREFS;
  }

  return {
    emailEnabled: data.email_enabled ?? DEFAULT_NOTIFICATION_PREFS.emailEnabled,
    inAppEnabled: data.in_app_enabled ?? DEFAULT_NOTIFICATION_PREFS.inAppEnabled,
    teamDigestEnabled: data.team_digest_enabled ?? DEFAULT_NOTIFICATION_PREFS.teamDigestEnabled,
  };
}

export async function updateNotificationPreferences(
  client: SupabaseClient,
  userId: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(client, userId);
  const nextPrefs: NotificationPreferences = {
    ...current,
    ...updates,
  };

  const { error } = await client
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      email_enabled: nextPrefs.emailEnabled,
      in_app_enabled: nextPrefs.inAppEnabled,
      team_digest_enabled: nextPrefs.teamDigestEnabled,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }

  return nextPrefs;
}

async function sendNotificationEmail(
  notification: NotificationRecord,
  preferences: NotificationPreferences
) {
  if (!preferences.emailEnabled) {
    return;
  }

  // Placeholder for future email integration (Resend / SendGrid / etc.)
  console.info(
    `[notifications] Email queued for ${notification.user_id}: ${notification.title} - ${notification.message}`
  );
}

