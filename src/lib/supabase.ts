import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from '@/lib/db'
import { env } from '@/lib/env'

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
})
