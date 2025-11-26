'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './client';

let browserRealtimeClient: SupabaseClient | null = null;

export function getRealtimeClient(): SupabaseClient {
  if (!browserRealtimeClient) {
    browserRealtimeClient = createClient();
  }
  return browserRealtimeClient;
}

export function createRealtimeChannelName(parts: Array<string | number | undefined>) {
  return ['realtime', ...parts.filter(Boolean)].join(':');
}

