import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requiredEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_PUBLISHABLE_KEY']),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

