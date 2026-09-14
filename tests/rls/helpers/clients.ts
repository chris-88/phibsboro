// The five kinds of client the suite asserts through: anonymous, and one signed in per fixture.
// globalSetup signs each fixture in once and provides the session; every test file then builds
// its own client from it, so a run costs ten sign-ins rather than ten per file. Clients are
// memoised per fixture within a file and never handed from one fixture to another — a shared
// client carrying the wrong JWT is exactly the bug this suite exists to catch.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { inject } from 'vitest'

import type { Database } from '../../../src/lib/database.types.ts'
import { retryingFetch } from '../../helpers/retrying-fetch.ts'
import { TARGET } from '../../helpers/target.ts'
import { FIXTURES, SEED_PASSWORD, type Fixture } from './fixtures.ts'

export type Client = SupabaseClient<Database>
export type ProvidedSession = Pick<Session, 'access_token' | 'refresh_token'>

declare module 'vitest' {
  export interface ProvidedContext {
    /** Signed-in sessions, one per fixture, from globalSetup. */
    rlsSessions: Record<Fixture, ProvidedSession>
    /** Auth ids by phone, every seeded account, from globalSetup. */
    rlsIds: Record<string, string>
  }
}

/** A client holding nothing but the anon key: what an unauthenticated browser has. */
export function anonClient(): Client {
  return createClient<Database>(TARGET.url, TARGET.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: retryingFetch() },
  })
}

const memo = new Map<Fixture, Promise<Client>>()

/** A client signed in as the fixture. Memoised per fixture for this file. */
export function signInAs(fixture: Fixture): Promise<Client> {
  let pending = memo.get(fixture)
  if (!pending) {
    pending = (async () => {
      const client = anonClient()
      try {
        const { error } = await client.auth.setSession(inject('rlsSessions')[fixture])
        if (!error) return client
      } catch {
        // fall through to a fresh sign-in
      }
      // The session captured once in globalSetup can die mid-run: a transient gateway error
      // during setSession's internal validation, or the free-tier project under load. Rather
      // than fail every test that uses this fixture, re-authenticate it fresh — the retrying
      // fetch covers the sign-in — and memoise that instead.
      const fresh = anonClient()
      const { error: signInError } = await fresh.auth.signInWithPassword({
        phone: FIXTURES[fixture].phone,
        password: SEED_PASSWORD,
      })
      if (signInError) throw new Error(`signInAs ${fixture} failed: ${signInError.message}`)
      return fresh
    })()
    memo.set(fixture, pending)
  }
  return pending
}

/** A fresh client signed in with a phone and password: throwaway accounts and post-reset checks. */
export async function signInWith(phone: string, password: string): Promise<Client> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ phone, password })
  if (error) throw new Error(`sign-in as ${phone} failed: ${error.message}`)
  return client
}

/** The auth id of a seeded fixture. */
export function idOf(fixture: Fixture): string {
  return idOfPhone(FIXTURES[fixture].phone)
}

/** The auth id behind any seeded phone. */
export function idOfPhone(phone: string): string {
  const id = inject('rlsIds')[phone]
  if (!id) throw new Error(`no seeded account for ${phone}`)
  return id
}
