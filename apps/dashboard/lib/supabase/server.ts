import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requiredEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_PUBLISHABLE_KEY']),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes are unavailable in Server Components.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

