// Runs once before the suite, in the main process. Refuses any target but the project named
// by SUPABASE_PROJECT_REF, prints that ref and the row counts it is about to destroy (D63),
// wipes and reseeds through the same script `npm run db:seed -- --reset` runs, then signs in
// every fixture once and provides the sessions and ids to the test workers.
import { execFileSync } from 'node:child_process'
import type { TestProject } from 'vitest/node'

import type { Database } from '../../src/lib/database.types.ts'
import { adminClient, seedChildEnv } from '../helpers/admin.ts'
import { TARGET } from '../helpers/target.ts'
import { anonClient, type ProvidedSession } from './helpers/clients.ts'
import { FIXTURES, SEED_PASSWORD, type Fixture } from './helpers/fixtures.ts'

const TABLES: readonly (keyof Database['public']['Tables'])[] = [
  'profiles',
  'teams',
  'team_members',
  'team_invites',
  'reset_tokens',
  'events',
  'event_responses',
  'attendance',
]

export default async function setup(project: TestProject) {
  if (TARGET.kind !== 'hosted') throw new Error('tests/rls runs against the hosted project only')
  const admin = adminClient()

  console.log(`rls: project ${TARGET.ref} (${new URL(TARGET.url).hostname}) — about to wipe:`)
  for (const table of TABLES) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    console.log(`  ${table}: ${String(count ?? 0)}`)
  }

  // The seed, exactly as the npm script runs it, minus --env-file: the values are passed
  // explicitly so CI (environment) and a developer (.env.local) take the same path.
  execFileSync(process.execPath, ['supabase/seed/seed.ts', '--reset'], {
    stdio: 'inherit',
    env: { ...process.env, ...seedChildEnv() },
  })

  const { data: profiles, error } = await admin.from('profiles').select('id, phone')
  if (error) throw new Error(`profiles: ${error.message}`)
  const ids: Record<string, string> = {}
  for (const p of profiles) ids[p.phone] = p.id

  const sessions = {} as Record<Fixture, ProvidedSession>
  for (const fixture of Object.keys(FIXTURES) as Fixture[]) {
    const client = anonClient()
    const { data, error: signInError } = await client.auth.signInWithPassword({
      phone: FIXTURES[fixture].phone,
      password: SEED_PASSWORD,
    })
    if (signInError) throw new Error(`sign-in as ${fixture} failed: ${signInError.message}`)
    const { access_token, refresh_token } = data.session
    sessions[fixture] = { access_token, refresh_token }
  }

  project.provide('rlsSessions', sessions)
  project.provide('rlsIds', ids)
}
