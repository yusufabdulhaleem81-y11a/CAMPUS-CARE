import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

/** Client that enforces RLS as the authenticated caller. */
export function asUser(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

/** Privileged client for operations the database cannot do for a user:
 *  account creation, role changes, password resets. Use sparingly. */
export const admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false },
});

export const anon = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false },
});
