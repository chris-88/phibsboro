// S1.2 — the seed. Reseeds the target with --reset first (D63: one project, tests may wipe it;
// the seed prints what it wipes), then asserts the state AC16 to AC22 describe, signs in as all
// 25 accounts, and exercises the two refusal guards by spawning the script.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  ATTENDANCE,
  E2E_RESERVED_PREFIX,
  EVENTS,
  EVERYONE,
  LEAVER,
  MANAGERS,
  MEMBERSHIPS,
  NO_TEAM,
  PLAYERS,
  RESPONSES,
  SEED_PASSWORD,
  TEAMS,
  TEAM_FIRSTS,
  TEAM_SECONDS,
  eventFor,
} from '../../supabase/seed/fixtures.ts'
import { adminClient, userIdByPhone } from '../helpers/admin.ts'
import { anonClient } from '../helpers/local.ts'
import { closeSql, scalar } from '../helpers/sql.ts'
import { LOCAL, TARGET } from '../helpers/target.ts'

const SEED = join('supabase', 'seed', 'seed.ts')
const admin = adminClient()

/**
 * Runs the seed as `npm run db:seed` would. The child never inherits a target from this
 * process: local runs get the local URL and the seed's built-in local key; hosted runs get
 * .env.local through Node's own --env-file, exactly as the npm script does.
 */
function runSeed(args: string[], overrides: Record<string, string> = {}, envFile = true) {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/^(SUPABASE_|VITE_SUPABASE_|PFC_SEED_)/.test(k)) env[k] = v
  }
  const nodeArgs: string[] = []
  if (TARGET.kind === 'hosted') {
    if (envFile) nodeArgs.push('--env-file-if-exists=.env.local')
    env.PFC_SEED_ALLOW_REMOTE = '1'
  } else {
    env.SUPABASE_URL = LOCAL.url
  }
  Object.assign(env, overrides)
  const result = spawnSync(process.execPath, [...nodeArgs, SEED, ...args], {
    env,
    encoding: 'utf8',
    timeout: 110_000,
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

const hoursFromNow = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000

const rowsOf = async <
  T extends 'teams' | 'team_members' | 'events' | 'event_responses' | 'attendance',
>(
  table: T,
) => {
  const { data, error } = await admin.from(table).select('*')
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

beforeAll(() => {
  // One retry: --reset is idempotent, and a transient error from the hosted project (seen once,
  // not reproduced in six later runs) should be printed, not mistaken for a broken seed.
  let result = runSeed(['--reset'])
  if (result.status !== 0) {
    console.error(`seed --reset failed once, retrying:\n${result.stderr}`)
    result = runSeed(['--reset'])
  }
  console.log(result.stdout.trim().split('\n').slice(-14).join('\n'))
  if (result.status !== 0) throw new Error(`seed --reset failed:\n${result.stderr}`)
})

afterAll(closeSql)

describe('AC16 — the club in a known state', () => {
  it('two active teams with the fixed ids and no clubs table', async () => {
    const teams = await rowsOf('teams')
    expect(
      teams
        .map((t) => ({ id: t.id, name: t.name, active: t.active }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(TEAMS.map((t) => ({ id: t.id, name: t.name, active: true })))
    expect(
      await scalar(
        `select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'clubs'`,
      ),
    ).toBe(0)
  })

  it('25 auth users and 25 profiles: 1 admin, 2 managers, 20 players, one no-team, one leaver', async () => {
    expect(EVERYONE).toHaveLength(25)
    expect(MANAGERS).toHaveLength(2)
    expect(PLAYERS).toHaveLength(20)
    expect(await scalar('select count(*) from auth.users')).toBe(25)
    expect(await scalar('select count(*) from public.profiles')).toBe(25)
    for (const person of EVERYONE) {
      expect(
        await scalar(
          `select count(*) from public.profiles where phone = '${person.phone}' and name = '${person.name}'`,
        ),
      ).toBe(1)
    }
  })
})

describe('AC17 — every seeded account signs in with the anon client', () => {
  it.each(EVERYONE.map((p) => [p.name, p.phone] as const))('%s', async (_name, phone) => {
    const { data, error } = await anonClient().auth.signInWithPassword({
      phone,
      password: SEED_PASSWORD,
    })
    expect(error).toBeNull()
    expect(data.session?.access_token).toBeTruthy()
  })
})

describe('AC18 — roles', () => {
  it('exactly one admin, and it is the fixture admin', async () => {
    expect(await scalar('select count(*) from public.profiles where is_admin')).toBe(1)
    expect(
      await scalar(
        `select count(*) from public.profiles where is_admin and phone = '${ADMIN.phone}'`,
      ),
    ).toBe(1)
  })

  it('memberships are player or manager only, and one person holds both across teams', async () => {
    const members = await rowsOf('team_members')
    expect(members).toHaveLength(MEMBERSHIPS.length)
    expect(new Set(members.map((m) => m.role))).toEqual(new Set(['player', 'manager']))

    const declan = await userIdByPhone(MANAGERS[0].phone)
    const roles = members.filter((m) => m.user_id === declan)
    expect(roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ team_id: TEAM_FIRSTS.id, role: 'manager' }),
        expect.objectContaining({ team_id: TEAM_SECONDS.id, role: 'player' }),
      ]),
    )
    expect(roles).toHaveLength(2)
  })
})

describe('AC19 — the event mix per team', () => {
  it.each(TEAMS.map((t) => [t.name, t.id] as const))('%s', async (_name, teamId) => {
    const events = (await rowsOf('events')).filter((e) => e.team_id === teamId)
    expect(events).toHaveLength(4)
    const far = events.find((e) => e.id === eventFor(teamId, 'far').id)
    const imminent = events.find((e) => e.id === eventFor(teamId, 'imminent').id)
    const past = events.find((e) => e.id === eventFor(teamId, 'past').id)
    const cancelled = events.find((e) => e.id === eventFor(teamId, 'cancelled').id)
    if (!far || !imminent || !past || !cancelled) throw new Error('an event is missing')

    expect(far.status).toBe('scheduled')
    expect(hoursFromNow(far.starts_at)).toBeGreaterThan(7 * 24)
    expect(imminent.status).toBe('scheduled')
    expect(hoursFromNow(imminent.starts_at)).toBeGreaterThan(0)
    expect(hoursFromNow(imminent.starts_at)).toBeLessThan(48)
    expect(hoursFromNow(past.starts_at)).toBeLessThan(0)
    expect(cancelled.status).toBe('cancelled')
  })
})

describe('AC20 — responses', () => {
  it('imminent events: some available, some unavailable, at least three members with no row', async () => {
    const members = await rowsOf('team_members')
    const responses = await rowsOf('event_responses')
    for (const team of TEAMS) {
      const event = eventFor(team.id, 'imminent')
      const squad = members.filter((m) => m.team_id === team.id).map((m) => m.user_id)
      const rows = responses.filter((r) => r.event_id === event.id && squad.includes(r.user_id))
      const available = rows.filter((r) => r.response === 'available').length
      const unavailable = rows.filter((r) => r.response === 'unavailable').length
      const awaiting = squad.length - rows.length
      expect(available).toBeGreaterThan(0)
      expect(unavailable).toBeGreaterThan(0)
      expect(awaiting).toBeGreaterThanOrEqual(3)
      expect(available + unavailable + awaiting).toBe(squad.length)
    }
  })

  it('every response row belongs to a current member, except the leaver (D22)', async () => {
    const members = await rowsOf('team_members')
    const events = await rowsOf('events')
    const leaver = await userIdByPhone(LEAVER.phone)
    const teamOf = new Map(events.map((e) => [e.id, e.team_id]))
    for (const r of await rowsOf('event_responses')) {
      const isMember = members.some(
        (m) => m.team_id === teamOf.get(r.event_id) && m.user_id === r.user_id,
      )
      expect(isMember || r.user_id === leaver).toBe(true)
    }
    expect((await rowsOf('event_responses')).length).toBe(RESPONSES.length)
  })
})

describe('AC21 — attendance on the past events', () => {
  it.each(TEAMS.map((t) => [t.name, t.id] as const))('%s', async (_name, teamId) => {
    const event = eventFor(teamId, 'past')
    const squad = (await rowsOf('team_members')).filter((m) => m.team_id === teamId)
    const rows = (await rowsOf('attendance')).filter((a) => a.event_id === event.id)
    const manager = squad.find((m) => m.role === 'manager')
    if (!manager) throw new Error('no manager')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((a) => !a.attended)).toBe(true)
    // Some members are not recorded at all: absence of a row, not a value (D25).
    const recorded = new Set(rows.map((a) => a.user_id))
    expect(squad.some((m) => !recorded.has(m.user_id))).toBe(true)
    expect(new Set(rows.map((a) => a.recorded_by))).toEqual(new Set([manager.user_id]))
    expect((await rowsOf('attendance')).length).toBe(ATTENDANCE.length)
  })
})

describe('AC22 — the leaver and the no-team user', () => {
  it('the leaver has a response and an attendance row on Firsts and no membership', async () => {
    const leaver = await userIdByPhone(LEAVER.phone)
    const members = (await rowsOf('team_members')).filter((m) => m.user_id === leaver)
    const responses = (await rowsOf('event_responses')).filter((r) => r.user_id === leaver)
    const attendance = (await rowsOf('attendance')).filter((a) => a.user_id === leaver)
    expect(members).toHaveLength(0)
    expect(responses).toHaveLength(1)
    expect(attendance).toHaveLength(1)
    const events = await rowsOf('events')
    for (const row of [...responses, ...attendance]) {
      expect(events.find((e) => e.id === row.event_id)?.team_id).toBe(TEAM_FIRSTS.id)
    }
  })

  it('the no-team user holds nothing at all', async () => {
    const id = await userIdByPhone(NO_TEAM.phone)
    expect((await rowsOf('team_members')).filter((m) => m.user_id === id)).toHaveLength(0)
    expect((await rowsOf('event_responses')).filter((r) => r.user_id === id)).toHaveLength(0)
    expect((await rowsOf('attendance')).filter((a) => a.user_id === id)).toHaveLength(0)
  })
})

describe('AC23, AC26 — determinism and the reserved range', () => {
  const seedSrc = readFileSync(SEED, 'utf8')
  const fixturesSrc = readFileSync(join('supabase', 'seed', 'fixtures.ts'), 'utf8')

  it('no randomness, one clock read', () => {
    for (const src of [seedSrc, fixturesSrc]) {
      expect(src).not.toMatch(/Math\.random|faker/)
    }
    expect(seedSrc.match(/new Date\(\)/g)).toHaveLength(1)
    expect(fixturesSrc).not.toMatch(/new Date\(/)
  })

  it('event ids are the fixed constants', async () => {
    const ids = (await rowsOf('events')).map((e) => e.id).sort()
    expect(ids).toEqual(EVENTS.map((e) => e.id).sort())
  })

  it('no fixture number is in the E2E range, and the range is documented', () => {
    for (const person of EVERYONE) expect(person.phone.startsWith(E2E_RESERVED_PREFIX)).toBe(false)
    expect(E2E_RESERVED_PREFIX).toBe('+3538990')
    expect(fixturesSrc).toMatch(/not secrets/)
  })
})

describe('AC24, AC25 — the guards', () => {
  it('refuses a database that already has teams', () => {
    const result = runSeed([])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('database is not empty; run supabase db reset first')
  })

  it('refuses a non-localhost URL without PFC_SEED_ALLOW_REMOTE=1, before touching anything', () => {
    const result = runSeed(
      [],
      { SUPABASE_URL: 'https://example.invalid', PFC_SEED_ALLOW_REMOTE: '' },
      false,
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/example\.invalid is not a local stack/)
  })
})
