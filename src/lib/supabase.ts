import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from '@/lib/db'
import { env } from '@/lib/env'
import { recordServerDate } from '@/lib/serverClock'

/**
 * Every request the client makes passes through here so the server clock can be captured from the
 * `Date` header (S3.3, D48) without a dedicated round trip. It only reads a header; it never
 * changes the request or the response.
 */
const trackingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  recordServerDate(res.headers.get('Date'))
  return res
}

/**
 * Exported so a test can pin the four flags S2.6 depends on (S1.5 AC5). Session longevity
 * itself is server configuration and belongs to S2.6 (D59).
 */
export const authOptions = {
  persistSession: true,
  autoRefreshToken: true,
  // HashRouter keeps the app's own route in the fragment. GoTrue must not try to read a
  // session out of "#/event/abc123", and nothing here ever arrives via an OAuth redirect.
  detectSessionInUrl: false,
  storageKey: 'pfc.auth',
  flowType: 'implicit',
} satisfies SupabaseClientOptions<'public'>['auth']

/**
 * The one client. Anonymous until someone signs in, which is how `get_event_preview` and
 * `lookup_team_invite` are reached cold (D7). Lint fails any other `createClient` import
 * under `src/` (S1.5 AC4).
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: authOptions,
  global: { fetch: trackingFetch },
})
