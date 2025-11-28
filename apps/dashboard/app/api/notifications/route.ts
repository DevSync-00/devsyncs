import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  markAllNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications';

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  teamDigestEnabled: z.boolean().optional(),
});

const markSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limitParam = Number.parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isNaN(limitParam) ? undefined : limitParam;

    const [notifications, unreadCount, preferences] = await Promise.all([
      listNotifications(supabase, user.id, { unreadOnly, limit }),
      countUnreadNotifications(supabase, user.id),
      getNotificationPreferences(supabase, user.id),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      preferences,
    });
  } catch (error) {
    console.error('[notifications] GET error', error);
    return NextResponse.json(
      { error: 'Failed to load notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body?.action as string | undefined;

    switch (action) {
      case 'mark-read': {
        const parsed = markSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Invalid notificationIds' },
            { status: 400 }
          );
        }
        await markNotificationsAsRead(supabase, user.id, parsed.data.notificationIds);
        const unreadCount = await countUnreadNotifications(supabase, user.id);
        return NextResponse.json({ success: true, unreadCount });
      }

      case 'mark-unread': {
        const parsed = markSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Invalid notificationIds' },
            { status: 400 }
          );
        }
        await markNotificationsAsUnread(supabase, user.id, parsed.data.notificationIds);
        const unreadCount = await countUnreadNotifications(supabase, user.id);
        return NextResponse.json({ success: true, unreadCount });
      }

      case 'mark-all-read': {
        await markAllNotificationsAsRead(supabase, user.id);
        return NextResponse.json({ success: true, unreadCount: 0 });
      }

      case 'update-preferences': {
        const parsed = updatePreferencesSchema.safeParse(body.preferences ?? {});
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Invalid preferences' },
            { status: 400 }
          );
        }

        const next = await updateNotificationPreferences(supabase, user.id, parsed.data);
        return NextResponse.json({ success: true, preferences: next });
      }

      default:
        return NextResponse.json(
          { error: 'Unsupported action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[notifications] POST error', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

