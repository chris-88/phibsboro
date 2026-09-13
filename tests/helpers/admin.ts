// Service-role access, for test setup only: fixtures and throwaway auth users. Never an
// assertion, never imported under src/ (D15, D38). The CLI's fixed local key, a published
// constant; read from .env.local only under the explicit hosted target (target.ts).
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types.ts'
import { TARGET, hostedValue } from './target.ts'

const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const serviceRoleKey = () =>
  TARGET.kind === 'hosted' ? hostedValue('SUPABASE_SERVICE_ROLE_KEY') : LOCAL_SERVICE_ROLE_KEY

/** Bypasses RLS. Setup and teardown only. */
export function adminClient() {
  return createClient<Database>(TARGET.url, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Creates a confirmed phone + password user the way the seed does (D15). Returns its id. */
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

/** The auth id behind a phone, via profiles. Every seed lookup is by phone (AC23). */
export async function userIdByPhone(phone: string) {
  const { data, error } = await adminClient().from('profiles').select('id').eq('phone', phone)
  if (error) throw new Error(`userIdByPhone ${phone} failed: ${error.message}`)
  const id = data[0]?.id
  if (!id) throw new Error(`no profile for ${phone}`)
  return id
}

/** Every auth user, across pages. */
export async function listAllUsers() {
  const admin = adminClient()
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}
