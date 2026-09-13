// Service-role access, for test setup only: fixtures and throwaway auth users. Never an
// assertion, never imported under src/ (D15, D38). The CLI's fixed local key, a published
// constant; not read from the environment for the reason given in local.ts.
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types.ts'
import { LOCAL } from './local.ts'

const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/** Bypasses RLS. Setup and teardown only. */
export function adminClient() {
  return createClient<Database>(LOCAL.url, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Creates a confirmed phone + password user the way the seed will (D15). Returns its id. */
export async function createUser(phone: string, password: string, name = 'Throwaway') {
  const { data, error } = await adminClient().auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
    user_metadata: { name },
  })
  if (error) throw new Error(`createUser ${phone} failed: ${error.message}`)
  return data.user.id
}

/** Deletes the auth user; profiles and everything below cascade (D4). */
export async function deleteUser(id: string) {
  const { error } = await adminClient().auth.admin.deleteUser(id)
  if (error) throw new Error(`deleteUser ${id} failed: ${error.message}`)
}
