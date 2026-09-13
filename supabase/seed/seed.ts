// S1.2 — the seed (D15). Creates the 25 accounts through the Auth admin API so the profile
// trigger populates profiles, then writes teams, memberships, events, responses and attendance
// with a service-role client. Everything here bypasses RLS by design: this is a setup tool and
// never an assertion.
//
//   npm run db:seed                      # local stack, or whatever .env.local points at
//   npm run db:seed -- --reset           # wipe every table and every auth user first
//
// Refuses a non-empty database unless --reset is passed (AC24), and refuses a non-localhost URL
// unless PFC_SEED_ALLOW_REMOTE=1 (AC25). Runs on Node 24 directly; no build step, no tsx.
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../../src/lib/database.types.ts'
import {
  ADMIN,
  ATTENDANCE,
  E2E_RESERVED_PREFIX,
  EVENTS,
  EVERYONE,
  LEAVER_MEMBERSHIP,
  MEMBERSHIPS,
  RESPONSES,
  SEED_PASSWORD,
  TEAMS,
} from './fixtures.ts'

// The CLI's local stack: published constants (D38), repeated in .env.example.
const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// A function declaration, so TypeScript narrows on `if (!x) fail(...)`.
function fail(message: string): never {
  console.error(`seed: ${message}`)
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? LOCAL_URL
const host = new URL(url).hostname
const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1'
if (!isLocal && process.env.PFC_SEED_ALLOW_REMOTE !== '1') {
  fail(`${host} is not a local stack; set PFC_SEED_ALLOW_REMOTE=1 to seed it deliberately`)
}
// Local has exactly one key. A hosted key left in .env.local must not be sent to the local stack.
const serviceRoleKey = isLocal
  ? LOCAL_SERVICE_ROLE_KEY
  : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail('SUPABASE_SERVICE_ROLE_KEY is not set'))

const reset = process.argv.includes('--reset')

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

type Table = keyof Database['public']['Tables']
const TABLES: readonly Table[] = [
  'teams',
  'profiles',
  'team_members',
  'team_invites',
  'reset_tokens',
  'events',
  'event_responses',
  'attendance',
]

async function count(table: Table) {
  const { count: n, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) fail(`count ${table}: ${error.message}`)
  return n ?? 0
}

async function listAllUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`listUsers: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}

/** Every row in every table and every auth user. Order respects the restrict FKs onto teams. */
async function wipe() {
  const users = await listAllUsers()
  console.log(`seed: wiping ${host}`)
  for (const table of TABLES) console.log(`  ${table}: ${String(await count(table))}`)
  console.log(`  auth.users: ${String(users.length)}`)
  // PostgREST refuses an unfiltered delete; `not id is null` matches every row.
  const clear = async (table: Table, column: string) => {
    const { error } = await admin.from(table).delete().not(column, 'is', null)
    if (error) fail(`wipe ${table}: ${error.message}`)
  }
  await clear('attendance', 'event_id')
  await clear('event_responses', 'event_id')
  await clear('reset_tokens', 'id')
  await clear('team_invites', 'id')
  await clear('events', 'id')
  await clear('team_members', 'team_id')
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) fail(`deleteUser ${user.id}: ${error.message}`)
  }
  await clear('teams', 'id')
}

const check = (error: { message: string } | null, what: string) => {
  if (error) fail(`${what}: ${error.message}`)
}

async function main() {
  for (const person of EVERYONE) {
    if (person.phone.startsWith(E2E_RESERVED_PREFIX)) {
      fail(`${person.phone} is in the E2E range ${E2E_RESERVED_PREFIX} (D58)`)
    }
  }

  if ((await count('teams')) > 0) {
    if (!reset) fail('database is not empty; run supabase db reset first, or pass --reset')
    await wipe()
  } else if ((await listAllUsers()).length > 0) {
    // No teams but leftover accounts, from a half-finished run or the test suite.
    if (!reset) fail('database is not empty; run supabase db reset first, or pass --reset')
    await wipe()
  }

  // The only clock read. Every starts_at is an offset from it (AC23).
  const now = new Date()
  const at = (offsetHours: number) => new Date(now.getTime() + offsetHours * 3_600_000)

  // Accounts. phone_confirm means "created already confirmed"; nothing is sent (D15).
  const idByPhone = new Map<string, string>()
  for (const person of EVERYONE) {
    const { data, error } = await admin.auth.admin.createUser({
      phone: person.phone,
      password: SEED_PASSWORD,
      phone_confirm: true,
      user_metadata: { name: person.name },
    })
    check(error, `createUser ${person.phone}`)
    if (!data.user) fail(`createUser ${person.phone} returned no user`)
    idByPhone.set(person.phone, data.user.id)
  }
  const id = (phone: string) => {
    const found = idByPhone.get(phone)
    if (!found) fail(`no account for ${phone}`)
    return found
  }

  check(
    (await admin.from('teams').insert(TEAMS.map((t) => ({ id: t.id, name: t.name })))).error,
    'insert teams',
  )

  check(
    (
      await admin.from('team_members').insert(
        [...MEMBERSHIPS, LEAVER_MEMBERSHIP].map((m) => ({
          team_id: m.teamId,
          user_id: id(m.phone),
          role: m.role,
        })),
      )
    ).error,
    'insert team_members',
  )

  const managerOf = (teamId: string) => {
    const manager = MEMBERSHIPS.find((m) => m.teamId === teamId && m.role === 'manager')
    if (!manager) fail(`no manager for team ${teamId}`)
    return id(manager.phone)
  }
  check(
    (
      await admin.from('events').insert(
        EVENTS.map((e) => ({
          id: e.id,
          team_id: e.teamId,
          type: e.type,
          title: e.title,
          location: e.location,
          notes: e.notes,
          starts_at: at(e.offsetHours).toISOString(),
          status: e.status,
          created_by: managerOf(e.teamId),
        })),
      )
    ).error,
    'insert events',
  )

  check(
    (
      await admin.from('event_responses').insert(
        RESPONSES.map((r) => ({
          event_id: r.eventId,
          user_id: id(r.phone),
          response: r.response,
        })),
      )
    ).error,
    'insert event_responses',
  )

  check(
    (
      await admin.from('attendance').insert(
        ATTENDANCE.map((a) => ({
          event_id: a.eventId,
          user_id: id(a.phone),
          attended: a.attended,
          recorded_by: id(a.recordedBy),
        })),
      )
    ).error,
    'insert attendance',
  )

  // The one is_admin write outside the production bootstrap migration (D2, AC12).
  check(
    (await admin.from('profiles').update({ is_admin: true }).eq('phone', ADMIN.phone)).error,
    'set admin',
  )

  // The leaver: membership removed after their rows exist, as remove_member does (D33).
  check(
    (
      await admin
        .from('team_members')
        .delete()
        .eq('team_id', LEAVER_MEMBERSHIP.teamId)
        .eq('user_id', id(LEAVER_MEMBERSHIP.phone))
    ).error,
    'remove leaver',
  )

  console.log(`seed: done against ${host}`)
  for (const table of TABLES) console.log(`  ${table}: ${String(await count(table))}`)
  console.log(`  auth.users: ${String((await listAllUsers()).length)}`)
  for (const team of TEAMS) console.log(`  ${team.name}: ${team.id}`)
  console.log(`  admin: ${ADMIN.phone}`)
}

await main()
