'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Bell, BellRing, Check, Loader2, Mail, Settings } from 'lucide-react';
import { NotificationRecord, NotificationPreferences } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { robustFetchJSON, getErrorMessage } from '@/lib/fetch';

interface NotificationCenterProps {
  userId: string;
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
  initialPreferences: NotificationPreferences;
}

const MAX_VISIBLE_NOTIFICATIONS = 15;

export default function NotificationCenter({
  userId,
  initialNotifications,
  initialUnreadCount,
  initialPreferences,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [notifications]
  );

  const limitedNotifications = useMemo(
    () => sortedNotifications.slice(0, MAX_VISIBLE_NOTIFICATIONS),
    [sortedNotifications]
  );

  const hasUnread = unreadCount > 0;

  const refreshFromServer = useCallback(async (showIndicator: boolean = false) => {
    if (showIndicator) {
      setRefreshing(true);
    }
    try {
      const data = await robustFetchJSON<{
        notifications?: NotificationRecord[];
        unreadCount?: number;
        preferences?: NotificationPreferences;
      }>('/api/notifications');
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      if (data.preferences) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Unable to refresh notifications',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      if (showIndicator) {
        setRefreshing(false);
      }
    }
  }, [toast]);

  const markRead = useCallback(
    async (notificationId: string) => {
      setIsSubmitting(true);
      try {
        const data = await robustFetchJSON<{ unreadCount?: number }>('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({
            action: 'mark-read',
            notificationIds: [notificationId],
          }),
        });
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read_at: new Date().toISOString() }
              : notification
          )
        );
        setUnreadCount(data.unreadCount ?? 0);
      } catch (error) {
        toast({
          title: 'Unable to update notification',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [toast]
  );

  const markAllRead = useCallback(async () => {
    if (!hasUnread) return;
    setIsSubmitting(true);
    try {
      await robustFetchJSON('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      toast({
        title: 'Unable to mark all read',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [hasUnread, toast]);

  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
      try {
        const data = await robustFetchJSON<{ preferences?: NotificationPreferences }>('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update-preferences',
            preferences: { [key]: value },
          }),
        });
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      } catch (error) {
        toast({
          title: 'Unable to save preferences',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  useRealtimeTable<NotificationRecord>({
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
    enabled: Boolean(userId),
    onInsert: (payload) => {
      if (!payload.new) return;
      setNotifications((prev) => {
        const updated = [payload.new as NotificationRecord, ...prev];
        return updated.slice(0, MAX_VISIBLE_NOTIFICATIONS);
      });
      setUnreadCount((prev) => prev + 1);
      const notification = payload.new as any;
      toast({
        title: notification?.title || 'New Notification',
        description: notification?.message ?? 'You have a new notification.',
      });
    },
    onUpdate: () => {
      refreshFromServer();
    },
    onDelete: () => {
      refreshFromServer();
    },
  });

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="icon"
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        {hasUnread ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-4 min-w-[1rem] px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-3 w-96 rounded-lg border border-border bg-popover shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-sm text-muted-foreground">
                {hasUnread ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              disabled={!hasUnread || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Mark all read
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {limitedNotifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              limitedNotifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-border/70 ${isUnread ? 'bg-muted/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{notification.title}</p>
                        {notification.message && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => markRead(notification.id)}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border px-4 py-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>Email notifications</span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <span>{preferences.emailEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={preferences.emailEnabled}
                  onChange={(event) => updatePreference('emailEnabled', event.target.checked)}
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span>In-app notifications</span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <span>{preferences.inAppEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={preferences.inAppEnabled}
                  onChange={(event) => updatePreference('inAppEnabled', event.target.checked)}
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Team digest emails</span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <span>{preferences.teamDigestEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={preferences.teamDigestEnabled}
                  onChange={(event) => updatePreference('teamDigestEnabled', event.target.checked)}
                />
              </label>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshFromServer(true)}
              className="w-full mt-2 flex items-center justify-center gap-2"
              disabled={refreshing}
            >
              {refreshing && <Loader2 className="w-4 h-4 animate-spin" />}
              Refresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

