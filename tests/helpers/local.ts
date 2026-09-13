// Anon-key clients for tests/db: what an unauthenticated browser has, and one signed in as a
// seeded or throwaway user. Which stack they reach is decided in target.ts — the CLI's local
// stack unless PFC_DB_TARGET=hosted is set explicitly.
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types.ts'
import { TARGET } from './target.ts'

export { LOCAL } from './target.ts'

/** A client holding nothing but the anon key: what an unauthenticated browser has. */
export function anonClient() {
  return createClient<Database>(TARGET.url, TARGET.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** A client signed in as `phone` / `password`. Fails loudly rather than returning an anon client. */
export async function signedInClient(phone: string, password: string) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ phone, password })
  if (error) throw new Error(`sign-in as ${phone} failed: ${error.message}`)
  return client
}
