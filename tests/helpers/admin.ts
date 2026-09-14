// Service-role access, for test setup only: fixtures and throwaway auth users. Never an
// assertion, never imported under src/ (D15, D38). The local key comes from `supabase status`
// via target.ts; the hosted one from .env.local only under the explicit hosted target.
import { createClient } from '@supabase/supabase-js'
import { retryingFetch } from './retrying-fetch.ts'

import type { Database } from '../../src/lib/database.types.ts'
import { LOCAL, TARGET, hostedValue } from './target.ts'

const serviceRoleKey = () =>
  TARGET.kind === 'hosted' ? hostedValue('SUPABASE_SERVICE_ROLE_KEY') : LOCAL.serviceRoleKey

/**
 * The environment a child process needs to run supabase/seed/seed.ts against the current target:
 * URL, the service-role key, and the remote opt-in for the hosted project. The key never leaves
 * this file by name (D38); callers spread this into execFile's env.
 */
export function seedChildEnv(): Record<string, string> {
  return TARGET.kind === 'hosted'
    ? {
        SUPABASE_URL: TARGET.url,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey(),
        PFC_SEED_ALLOW_REMOTE: '1',
      }
    : { SUPABASE_URL: TARGET.url }
}

/** Bypasses RLS. Setup and teardown only. */
export function adminClient() {
  return createClient<Database>(TARGET.url, serviceRoleKey(), {
    global: { fetch: retryingFetch() },
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
