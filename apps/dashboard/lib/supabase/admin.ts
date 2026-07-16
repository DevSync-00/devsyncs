/**
 * Admin Supabase Client
 * Uses service role key to bypass RLS for server-side operations
 * Use with caution - only for operations that need to bypass RLS
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requiredEnv } from '@/lib/env';

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Get admin Supabase client (bypasses RLS)
 * Only use this for operations that require bypassing RLS
 */
export function getAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']);
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SECRET_KEY']);

  adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
