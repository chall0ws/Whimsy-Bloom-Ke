import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

let client: Promise<SupabaseClient> | null = null

/** The browser's Supabase connection (public anon key only), loaded on first use. */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // PKCE returns "?code=…" rather than tokens in the "#", which the hash-based page links need.
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    }),
  )
  return client
}

/** The signed-in person's token, sent to the server so it knows who's asking. */
export async function accessToken(): Promise<string | null> {
  const { data } = await (await getSupabase()).auth.getSession()
  return data.session?.access_token ?? null
}
