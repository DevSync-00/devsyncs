'use client';

import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getRealtimeClient, createRealtimeChannelName } from '@/lib/supabase/realtime';
import { useToast } from '@/hooks/use-toast';

type EventName = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeTableOptions<T extends Record<string, any> = Record<string, any>> {
  table: string;
  schema?: string;
  event?: EventName;
  filter?: string;
  enabled?: boolean;
  channel?: string;
  onPayload?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onInsert?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeTable<T extends Record<string, any> = Record<string, any>>(options: UseRealtimeTableOptions<T>) {
  const {
    table,
    schema = 'public',
    event = '*',
    filter,
    enabled = true,
    channel,
  } = options;

  const handlersRef = useRef(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options.onPayload, options.onInsert, options.onUpdate, options.onDelete, options.onError]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = getRealtimeClient();
    const channelName = channel || createRealtimeChannelName([schema, table, filter]);
    const realtimeChannel = supabase.channel(channelName);

    const handler = (payload: RealtimePostgresChangesPayload<T>) => {
      const { onPayload, onInsert, onUpdate, onDelete } = handlersRef.current;
      onPayload?.(payload);

      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload);
          break;
        case 'UPDATE':
          onUpdate?.(payload);
          break;
        case 'DELETE':
          onDelete?.(payload);
          break;
        default:
          break;
      }
    };

    realtimeChannel.on(
      'postgres_changes' as any,
      {
        event,
        schema,
        table,
        filter,
      },
      handler
    ).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Successfully subscribed
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const { onError } = handlersRef.current;
        if (onError) {
          onError(new Error(`Realtime subscription ${status.toLowerCase()}`));
        }
      }
    });

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [table, schema, event, filter, enabled, channel]);
}

export function useTeamActivityNotifications(teamIds: string[]) {
  const { toast } = useToast();
  const teamIdsRef = useRef(new Set(teamIds.filter(Boolean)));

  useEffect(() => {
    teamIdsRef.current = new Set(teamIds.filter(Boolean));
  }, [teamIds]);

  const channelKey = createRealtimeChannelName([
    'team-activity',
    Array.from(teamIdsRef.current).sort().join(','),
  ]);

  useRealtimeTable({
    table: 'projects',
    enabled: teamIdsRef.current.size > 0,
    channel: channelKey,
    onInsert: (payload) => handleTeamEvent(payload, 'created'),
    onUpdate: (payload) => handleTeamEvent(payload, 'updated'),
  });

  function handleTeamEvent(
    payload: RealtimePostgresChangesPayload<Record<string, any>>,
    type: 'created' | 'updated'
  ) {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;
    const teamId = newRecord?.team_id || oldRecord?.team_id;
    if (!teamId || !teamIdsRef.current.has(teamId)) {
      return;
    }

    const projectName = newRecord?.name || 'A project';
    toast({
      title: type === 'created' ? 'Team project created' : 'Team project updated',
      description: `${projectName} was ${type} by your team.`,
    });
  }
}

