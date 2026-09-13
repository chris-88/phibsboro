// The CLI's local stack, as tests reach it. Every value is a published constant that
// `supabase start` prints on every machine (D38), repeated in .env.example. Deliberately not
// read from the environment: Vitest copies VITE_-prefixed keys from .env.local into process.env,
// which would silently point a test at the hosted project.
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types.ts'

export const LOCAL = {
  url: 'http://127.0.0.1:54321',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
} as const

/** A client holding nothing but the anon key: what an unauthenticated browser has. */
export function anonClient() {
  return createClient<Database>(LOCAL.url, LOCAL.anonKey, {
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
