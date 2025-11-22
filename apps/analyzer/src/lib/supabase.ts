import { createClient, User } from '@supabase/supabase-js';
import { config } from '../config.js';

const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function getUserFromAccessToken(accessToken: string): Promise<User> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Unable to load Supabase user');
  }

  return data.user;
}

