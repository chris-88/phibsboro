// S1.1 — structural assertions against the CLI's local stack after `supabase db reset`.
// Reads information_schema and pg_catalog rather than DDL strings, and proves every constraint
// by its failing insert, not only by its presence. Destructive cases run inside a transaction
// that is rolled back; AC14 needs separate transactions and cleans up after itself.
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminClient, createUser, deleteUser } from '../helpers/admin.ts'
import { LOCAL, anonClient, signedInClient } from '../helpers/local.ts'

const TABLES = [
  'attendance',
  'event_responses',
  'events',
  'profiles',
  'reset_tokens',
  'team_invites',
  'team_members',
  'teams',
] as const
type Table = (typeof TABLES)[number]

const ENUMS: Record<string, string[]> = {
  event_type: ['training', 'match'],
  event_status: ['scheduled', 'cancelled'],
  availability_response: ['available', 'unavailable'],
  member_role: ['player', 'manager'],
}

// spec/data-model.md, column for column. `udt` is information_schema.columns.udt_name.
interface Column {
  udt: string
  nullable: boolean
  dflt: string | null
}
const col = (udt: string, nullable = false, dflt: string | null = null): Column => ({
  udt,
  nullable,
  dflt,
})
const COLUMNS: Record<Table, Record<string, Column>> = {
  profiles: {
    id: col('uuid'),
    name: col('text'),
    phone: col('text'),
    is_admin: col('bool', false, 'false'),
    created_at: col('timestamptz', false, 'now()'),
  },
  teams: {
    id: col('uuid', false, 'gen_random_uuid()'),
    name: col('text'),
    active: col('bool', false, 'true'),
    created_at: col('timestamptz', false, 'now()'),
  },
  team_members: {
    team_id: col('uuid'),
    user_id: col('uuid'),
    role: col('member_role', false, "'player'::member_role"),
    joined_at: col('timestamptz', false, 'now()'),
  },
  team_invites: {
    id: col('uuid', false, 'gen_random_uuid()'),
    team_id: col('uuid'),
    token: col('text'),
    role: col('member_role'),
    active: col('bool', false, 'true'),
    expires_at: col('timestamptz', true),
    created_by: col('uuid', true),
    created_at: col('timestamptz', false, 'now()'),
  },
  reset_tokens: {
    id: col('uuid', false, 'gen_random_uuid()'),
    user_id: col('uuid'),
    team_id: col('uuid'),
    token: col('text'),
    issued_at: col('timestamptz', false, 'now()'),
    expires_at: col('timestamptz', false, "(now() + '24:00:00'::interval)"),
    used_at: col('timestamptz', true),
    revoked_at: col('timestamptz', true),
    created_by: col('uuid', true),
  },
  events: {
    id: col('uuid', false, 'gen_random_uuid()'),
    team_id: col('uuid'),
    type: col('event_type'),
    title: col('text'),
    location: col('text'),
    notes: col('text', true),
    starts_at: col('timestamptz'),
    status: col('event_status', false, "'scheduled'::event_status"),
    series_id: col('uuid', true),
    created_by: col('uuid', true),
    created_at: col('timestamptz', false, 'now()'),
    updated_at: col('timestamptz', false, 'now()'),
  },
  event_responses: {
    event_id: col('uuid'),
    user_id: col('uuid'),
    response: col('availability_response'),
    updated_at: col('timestamptz', false, 'now()'),
  },
  attendance: {
    event_id: col('uuid'),
    user_id: col('uuid'),
    attended: col('bool'),
    recorded_by: col('uuid', true),
    updated_at: col('timestamptz', false, 'now()'),
  },
}

// (table, column, target, on delete), from data-model.md and D4.
const FOREIGN_KEYS = [
  ['attendance', 'event_id', 'events', 'cascade'],
  ['attendance', 'recorded_by', 'profiles', 'set null'],
  ['attendance', 'user_id', 'profiles', 'cascade'],
  ['event_responses', 'event_id', 'events', 'cascade'],
  ['event_responses', 'user_id', 'profiles', 'cascade'],
  ['events', 'created_by', 'profiles', 'set null'],
  ['events', 'team_id', 'teams', 'restrict'],
  ['profiles', 'id', 'auth.users', 'cascade'],
  ['reset_tokens', 'created_by', 'profiles', 'set null'],
  ['reset_tokens', 'team_id', 'teams', 'restrict'],
  ['reset_tokens', 'user_id', 'profiles', 'cascade'],
  ['team_invites', 'created_by', 'profiles', 'set null'],
  ['team_invites', 'team_id', 'teams', 'restrict'],
  ['team_members', 'team_id', 'teams', 'restrict'],
  ['team_members', 'user_id', 'profiles', 'cascade'],
] as const

const UPDATED_AT_TABLES = ['events', 'event_responses', 'attendance'] as const
const RPC_ONLY_TABLES = ['team_invites', 'reset_tokens'] as const

const pool = new pg.Pool({ connectionString: LOCAL.databaseUrl, max: 2 })
const sql = <R extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
  pool.query<R>(text, values)

/** Runs `fn` in a transaction that is always rolled back, so no test leaves rows behind. */
async function rolledBack(fn: (c: pg.PoolClient) => Promise<void>) {
  const c = await pool.connect()
  try {
    await c.query('begin')
    await fn(c)
  } finally {
    await c.query('rollback')
    c.release()
  }
}

/**
 * Asserts the statement fails with exactly this SQLSTATE. Wrapped in a savepoint, because a
 * failed statement otherwise aborts the surrounding transaction and every later assertion
 * would see 25P02 instead of its own error.
 */
async function expectSqlState(c: pg.PoolClient, code: string, run: () => Promise<unknown>) {
  await c.query('savepoint expected_failure')
  let got: string | undefined
  try {
    await run()
  } catch (e) {
    got = e instanceof pg.DatabaseError ? e.code : `not a DatabaseError: ${String(e)}`
  }
  await c.query('rollback to savepoint expected_failure')
  expect(got).toBe(code)
}

/** Two auth users, two teams, two events and a row in every table. Caller owns the transaction. */
async function fixtures(c: pg.PoolClient) {
  const u1 = crypto.randomUUID()
  const u2 = crypto.randomUUID()
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, phone, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '353870000001', now(), now()),
            ($2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '353870000002', now(), now())`,
    [u1, u2],
  )
  await c.query(
    `insert into public.profiles (id, name, phone) values ($1, 'Alpha', '+353870000001'), ($2, 'Bravo', '+353870000002')`,
    [u1, u2],
  )
  const t1 = (
    await c.query<{ id: string }>(`insert into public.teams (name) values ('Firsts') returning id`)
  ).rows[0]?.id
  const t2 = (
    await c.query<{ id: string }>(`insert into public.teams (name) values ('Seconds') returning id`)
  ).rows[0]?.id
  if (!t1 || !t2) throw new Error('team fixtures did not insert')
  await c.query(`insert into public.team_members (team_id, user_id) values ($1, $2), ($1, $3)`, [
    t1,
    u1,
    u2,
  ])
  await c.query(
    `insert into public.team_invites (team_id, token, role, created_by) values ($1, 'tok-a', 'player', $2)`,
    [t1, u1],
  )
  await c.query(
    `insert into public.reset_tokens (user_id, team_id, token, created_by) values ($1, $2, 'rst-a', $3)`,
    [u2, t1, u1],
  )
  const e1 = (
    await c.query<{ id: string }>(
      `insert into public.events (team_id, type, title, location, starts_at, created_by)
       values ($1, 'training', 'Training', 'Dalymount', now() + interval '1 day', $2) returning id`,
      [t1, u1],
    )
  ).rows[0]?.id
  const e2 = (
    await c.query<{ id: string }>(
      `insert into public.events (team_id, type, title, location, starts_at, series_id, created_by)
       values ($1, 'training', 'Training', 'Dalymount', now() + interval '8 days', gen_random_uuid(), $2) returning id`,
      [t1, u1],
    )
  ).rows[0]?.id
  if (!e1 || !e2) throw new Error('event fixtures did not insert')
  await c.query(
    `insert into public.event_responses (event_id, user_id, response) values ($1, $2, 'available')`,
    [e1, u2],
  )
  await c.query(
    `insert into public.attendance (event_id, user_id, attended, recorded_by) values ($1, $2, true, $3)`,
    [e1, u2, u1],
  )
  return { u1, u2, t1, t2, e1, e2 }
}

const count = async (c: pg.PoolClient, table: Table, where: string, values: unknown[]) =>
  Number(
    (
      await c.query<{ n: string }>(
        `select count(*) as n from public.${table} where ${where}`,
        values,
      )
    ).rows[0]?.n,
  )

afterAll(() => pool.end())

describe('database', () => {
  it('is the Postgres major version the hosted project runs', async () => {
    const { rows } = await sql<{ server_version_num: string }>('show server_version_num')
    expect(rows[0]?.server_version_num.slice(0, 2)).toBe('17')
  })

  it('AC1 — extensions.gen_random_bytes is available for the S1.3 token RPCs', async () => {
    const { rows } = await sql<{ ok: boolean }>(
      'select extensions.gen_random_bytes(32) is not null as ok',
    )
    expect(rows[0]?.ok).toBe(true)
  })
})

describe('tables and types', () => {
  it('AC2 — exactly the eight tables exist in public', async () => {
    const { rows } = await sql<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`,
    )
    expect(rows.map((r) => r.tablename)).toEqual([...TABLES])
  })

  it('AC3 — four enums with the right labels in the right order, and no admin role', async () => {
    const { rows } = await sql<{ typname: string; labels: string[] }>(
      `select t.typname, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
       from pg_type t join pg_enum e on e.enumtypid = t.oid
       where t.typnamespace = 'public'::regnamespace group by t.typname`,
    )
    expect(Object.fromEntries(rows.map((r) => [r.typname, r.labels]))).toEqual(ENUMS)
    expect(ENUMS.member_role).not.toContain('admin')
  })

  it('AC4 — every column in data-model.md, with its type, nullability and default, and no other', async () => {
    const { rows } = await sql<{
      table_name: Table
      column_name: string
      udt_name: string
      is_nullable: 'YES' | 'NO'
      column_default: string | null
    }>(
      `select table_name, column_name, udt_name, is_nullable, column_default
       from information_schema.columns where table_schema = 'public'`,
    )
    const actual: Record<string, Record<string, Column>> = {}
    for (const r of rows) {
      const table = (actual[r.table_name] ??= {})
      table[r.column_name] = col(r.udt_name, r.is_nullable === 'YES', r.column_default)
    }
    expect(actual).toEqual(COLUMNS)
  })
})

describe('keys and indexes', () => {
  it('AC5 — every foreign key targets what the model says with the stated on-delete action', async () => {
    const { rows } = await sql<{ tbl: string; col: string; target: string; action: string }>(
      `select c.conrelid::regclass::text as tbl, a.attname as col, c.confrelid::regclass::text as target,
              case c.confdeltype when 'c' then 'cascade' when 'r' then 'restrict'
                                 when 'n' then 'set null' when 'a' then 'no action' end as action
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
       order by 1, 2`,
    )
    expect(rows.map((r) => [r.tbl, r.col, r.target, r.action])).toEqual(
      FOREIGN_KEYS.map((f) => [...f]),
    )
    // D4: only profiles.id reaches auth.users.
    expect(rows.filter((r) => r.target === 'auth.users').map((r) => `${r.tbl}.${r.col}`)).toEqual([
      'profiles.id',
    ])
  })

  it('AC6 — composite primary keys on the three join tables, with no surrogate id', async () => {
    const { rows } = await sql<{ tbl: string; cols: string[] }>(
      `select conrelid::regclass::text as tbl,
              (select array_agg(attname::text order by ordinality)
               from unnest(conkey) with ordinality as k(attnum, ordinality)
               join pg_attribute a on a.attrelid = conrelid and a.attnum = k.attnum) as cols
       from pg_constraint where contype = 'p' and connamespace = 'public'::regnamespace`,
    )
    const pk = Object.fromEntries(rows.map((r) => [r.tbl, r.cols]))
    expect(pk.team_members).toEqual(['team_id', 'user_id'])
    expect(pk.event_responses).toEqual(['event_id', 'user_id'])
    expect(pk.attendance).toEqual(['event_id', 'user_id'])
    for (const t of ['team_members', 'event_responses', 'attendance'] as const) {
      expect(Object.keys(COLUMNS[t])).not.toContain('id')
    }
  })

  it('AC7 — unique constraints on phone and both tokens, case-insensitive unique team name', async () => {
    const { rows } = await sql<{ conname: string }>(
      `select conname from pg_constraint where contype = 'u' and connamespace = 'public'::regnamespace order by 1`,
    )
    expect(rows.map((r) => r.conname)).toEqual([
      'profiles_phone_key',
      'reset_tokens_token_key',
      'team_invites_token_key',
    ])
    const idx = await sql<{ indexdef: string }>(
      `select indexdef from pg_indexes where indexname = 'teams_name_key'`,
    )
    expect(idx.rows[0]?.indexdef).toContain(
      'UNIQUE INDEX teams_name_key ON public.teams USING btree (lower(btrim(name)))',
    )

    await rolledBack(async (c) => {
      const f = await fixtures(c)
      await expectSqlState(c, '23505', () =>
        c.query(`insert into public.teams (name) values ('firsts')`),
      )
      await expectSqlState(c, '23505', () =>
        c.query(`insert into public.teams (name) values ('  FIRSTS ')`),
      )
      await expectSqlState(c, '23505', () =>
        c.query(
          `insert into public.profiles (id, name, phone) values ($1, 'Dup', '+353870000001')`,
          [crypto.randomUUID()],
        ),
      )
      await expectSqlState(c, '23505', () =>
        c.query(
          `insert into public.team_invites (team_id, token, role, active) values ($1, 'tok-a', 'player', false)`,
          [f.t2],
        ),
      )
      await expectSqlState(c, '23505', () =>
        c.query(
          `insert into public.reset_tokens (user_id, team_id, token) values ($1, $2, 'rst-a')`,
          [f.u1, f.t1],
        ),
      )
    })
  })

  it('AC8 — the partial unique indexes bite, and only where they should', async () => {
    const { rows } = await sql<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes
       where indexname in ('team_invites_one_live_idx', 'events_series_slot_idx')`,
    )
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]))
    expect(defs.team_invites_one_live_idx).toContain('UNIQUE INDEX')
    expect(defs.team_invites_one_live_idx).toContain('(team_id, role) WHERE active')
    expect(defs.events_series_slot_idx).toContain('UNIQUE INDEX')
    expect(defs.events_series_slot_idx).toContain(
      '(team_id, starts_at) WHERE (series_id IS NOT NULL)',
    )

    await rolledBack(async (c) => {
      const f = await fixtures(c)
      await expectSqlState(c, '23505', () =>
        c.query(
          `insert into public.team_invites (team_id, token, role) values ($1, 'tok-b', 'player')`,
          [f.t1],
        ),
      )
      // An inactive duplicate and a live link for the other role are both fine.
      await c.query(
        `insert into public.team_invites (team_id, token, role, active) values ($1, 'tok-c', 'player', false)`,
        [f.t1],
      )
      await c.query(
        `insert into public.team_invites (team_id, token, role) values ($1, 'tok-d', 'manager')`,
        [f.t1],
      )

      const generated = `insert into public.events (team_id, type, title, location, starts_at, series_id)
                         select team_id, type, title, location, starts_at, gen_random_uuid() from public.events where id = $1`
      await expectSqlState(c, '23505', () => c.query(generated, [f.e2]))
      const handMade = `insert into public.events (team_id, type, title, location, starts_at)
                        select team_id, 'match', 'Cup', location, starts_at from public.events where id = $1`
      expect((await c.query(handMade, [f.e2])).rowCount).toBe(1)
    })
  })

  it('AC9 — the lookup indexes exist', async () => {
    const { rows } = await sql<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where schemaname = 'public'`,
    )
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]))
    expect(defs.events_team_starts_idx).toContain(
      'ON public.events USING btree (team_id, starts_at)',
    )
    expect(defs.team_members_user_id_idx).toContain('ON public.team_members USING btree (user_id)')
    expect(defs.event_responses_user_idx).toContain(
      'ON public.event_responses USING btree (user_id)',
    )
    expect(defs.attendance_user_idx).toContain('ON public.attendance USING btree (user_id)')
    expect(defs.reset_tokens_live_idx).toContain(
      'ON public.reset_tokens USING btree (user_id) WHERE ((used_at IS NULL) AND (revoked_at IS NULL))',
    )
  })
})

describe('checks', () => {
  it('AC10 — every check constraint rejects its bad case', async () => {
    await rolledBack(async (c) => {
      const f = await fixtures(c)
      const event = (title: string, location: string, notes: string | null = null) =>
        c.query(
          `insert into public.events (team_id, type, title, location, starts_at, notes) values ($1, 'match', $2, $3, now(), $4)`,
          [f.t1, title, location, notes],
        )
      const profile = (name: string, phone: string) =>
        c.query(`insert into public.profiles (id, name, phone) values ($1, $2, $3)`, [
          crypto.randomUUID(),
          name,
          phone,
        ])

      await expectSqlState(c, '23514', () => c.query(`insert into public.teams (name) values ('')`))
      await expectSqlState(c, '23514', () =>
        c.query(`insert into public.teams (name) values ('   ')`),
      )
      await expectSqlState(c, '23514', () =>
        c.query(`insert into public.teams (name) values ($1)`, ['x'.repeat(61)]),
      )
      await expectSqlState(c, '23514', () => profile('', '+353870000009'))
      await expectSqlState(c, '23514', () => profile('   ', '+353870000009'))
      await expectSqlState(c, '23514', () => profile('x'.repeat(81), '+353870000009'))
      await expectSqlState(c, '23514', () => event('', 'Here'))
      await expectSqlState(c, '23514', () => event('   ', 'Here'))
      await expectSqlState(c, '23514', () => event('x'.repeat(81), 'Here'))
      await expectSqlState(c, '23514', () => event('Cup', ''))
      await expectSqlState(c, '23514', () => event('Cup', 'x'.repeat(121)))
      await expectSqlState(c, '23514', () => event('Cup', 'Here', 'n'.repeat(501)))
      for (const bad of [
        '0871234567',
        '+353 87 123 4567',
        '353871234567',
        '+0871234567',
        '+35387',
      ]) {
        await expectSqlState(c, '23514', () => profile('Someone', bad))
      }
      // The good cases go through, so the checks are not simply refusing everything.
      const u3 = crypto.randomUUID()
      await c.query(`insert into auth.users (id) values ($1)`, [u3])
      await c.query(`insert into public.profiles (id, name, phone) values ($1, $2, $3)`, [
        u3,
        'x'.repeat(80),
        '+353871234567',
      ])
      await event('x'.repeat(80), 'x'.repeat(120), 'n'.repeat(500))
    })
  })
})

describe('row level security', () => {
  it('AC11 — RLS is enabled and not forced on all eight tables', async () => {
    const { rows } = await sql<{
      relname: string
      relrowsecurity: boolean
      relforcerowsecurity: boolean
    }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    )
    expect(rows.map((r) => r.relname)).toEqual([...TABLES])
    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} rowsecurity`).toBe(true)
      expect(r.relforcerowsecurity, `${r.relname} force`).toBe(false)
    }
  })

  it('AC13 — anon and authenticated hold no privilege on the two RPC-only tables', async () => {
    const { rows } = await sql<{ table_name: string; grantee: string; privilege_type: string }>(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'authenticated') and table_name = any ($1)`,
      [[...RPC_ONLY_TABLES]],
    )
    expect(rows).toEqual([])
  })

  describe('AC12 — deny-all baseline through PostgREST', () => {
    const admin = adminClient()
    const password = 'throwaway-password'
    const fixturePhone = '+353899900001'
    const viewerPhone = '+353899900002'
    let fixtureUser = ''
    let viewer = ''
    let team = ''
    let event = ''

    beforeAll(async () => {
      fixtureUser = await createUser(fixturePhone, password, 'Fixture')
      viewer = await createUser(viewerPhone, password, 'Viewer')
      const fail = (step: string, error: { message: string } | null) => {
        if (error) throw new Error(`${step}: ${error.message}`)
      }
      // No profiles trigger until S1.2, so the fixture profile is inserted by hand.
      fail(
        'profiles',
        (
          await admin
            .from('profiles')
            .insert({ id: fixtureUser, name: 'Fixture', phone: fixturePhone })
        ).error,
      )
      const t = await admin.from('teams').insert({ name: 'ac12-fixture' }).select('id').single()
      fail('teams', t.error)
      team = t.data?.id ?? ''
      fail(
        'team_members',
        (await admin.from('team_members').insert({ team_id: team, user_id: fixtureUser })).error,
      )
      fail(
        'team_invites',
        (
          await admin
            .from('team_invites')
            .insert({ team_id: team, token: 'ac12-invite', role: 'player' })
        ).error,
      )
      fail(
        'reset_tokens',
        (
          await admin
            .from('reset_tokens')
            .insert({ user_id: fixtureUser, team_id: team, token: 'ac12-reset' })
        ).error,
      )
      const e = await admin
        .from('events')
        .insert({
          team_id: team,
          type: 'training',
          title: 'Training',
          location: 'Here',
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select('id')
        .single()
      fail('events', e.error)
      event = e.data?.id ?? ''
      fail(
        'event_responses',
        (
          await admin
            .from('event_responses')
            .insert({ event_id: event, user_id: fixtureUser, response: 'available' })
        ).error,
      )
      fail(
        'attendance',
        (
          await admin
            .from('attendance')
            .insert({ event_id: event, user_id: fixtureUser, attended: true })
        ).error,
      )
    })

    afterAll(async () => {
      // The auth user cascades through profiles to memberships, responses and attendance.
      if (viewer) await deleteUser(viewer)
      if (fixtureUser) await deleteUser(fixtureUser)
      if (event) await admin.from('events').delete().eq('id', event)
      if (team) await admin.from('team_invites').delete().eq('team_id', team)
      if (team) await admin.from('teams').delete().eq('id', team)
    })

    it('has one row in every table as the service role sees it, so the denials below are not vacuous', async () => {
      for (const t of TABLES) {
        const { count: n, error } = await admin.from(t).select('*', { count: 'exact', head: true })
        expect(error, t).toBeNull()
        expect(n, t).toBe(1)
      }
    })

    const cases = [
      ['anon', () => Promise.resolve(anonClient())],
      ['authenticated', () => signedInClient(viewerPhone, password)],
    ] as const

    for (const [label, make] of cases) {
      it(`${label} selects zero rows from all eight and has every write refused`, async () => {
        const client = await make()
        // Either PostgREST refuses outright (42501, the two revoked tables) or RLS filters to nothing.
        interface Res {
          data: unknown
          error: { code?: string } | null
        }
        const refusedOrEmpty = (res: Res) =>
          res.error ? res.error.code === '42501' : Array.isArray(res.data) && res.data.length === 0
        type Attempt = Record<'select' | 'insert' | 'update' | 'remove', () => PromiseLike<Res>>
        // Updates and deletes target the fixture row, so a zero-row result is a denial, not a miss.
        const soon = new Date(Date.now() + 3_600_000).toISOString()
        const attempts: Record<Table, Attempt> = {
          profiles: {
            select: () => client.from('profiles').select('*'),
            insert: () =>
              client
                .from('profiles')
                .insert({ id: viewer, name: 'X', phone: '+353899900003' })
                .select(),
            update: () =>
              client.from('profiles').update({ name: 'Z' }).eq('id', fixtureUser).select(),
            remove: () => client.from('profiles').delete().eq('id', fixtureUser).select(),
          },
          teams: {
            select: () => client.from('teams').select('*'),
            insert: () => client.from('teams').insert({ name: 'ac12-attempt' }).select(),
            update: () => client.from('teams').update({ name: 'Z' }).eq('id', team).select(),
            remove: () => client.from('teams').delete().eq('id', team).select(),
          },
          team_members: {
            select: () => client.from('team_members').select('*'),
            insert: () =>
              client.from('team_members').insert({ team_id: team, user_id: viewer }).select(),
            update: () =>
              client.from('team_members').update({ role: 'manager' }).eq('team_id', team).select(),
            remove: () => client.from('team_members').delete().eq('team_id', team).select(),
          },
          team_invites: {
            select: () => client.from('team_invites').select('*'),
            insert: () =>
              client
                .from('team_invites')
                .insert({ team_id: team, token: 'ac12-attempt', role: 'player' })
                .select(),
            update: () =>
              client.from('team_invites').update({ active: false }).eq('team_id', team).select(),
            remove: () => client.from('team_invites').delete().eq('team_id', team).select(),
          },
          reset_tokens: {
            select: () => client.from('reset_tokens').select('*'),
            insert: () =>
              client
                .from('reset_tokens')
                .insert({ user_id: fixtureUser, team_id: team, token: 'ac12-attempt' })
                .select(),
            update: () =>
              client
                .from('reset_tokens')
                .update({ used_at: soon })
                .eq('user_id', fixtureUser)
                .select(),
            remove: () => client.from('reset_tokens').delete().eq('user_id', fixtureUser).select(),
          },
          events: {
            select: () => client.from('events').select('*'),
            insert: () =>
              client
                .from('events')
                .insert({
                  team_id: team,
                  type: 'match',
                  title: 'X',
                  location: 'X',
                  starts_at: soon,
                })
                .select(),
            update: () => client.from('events').update({ title: 'Z' }).eq('id', event).select(),
            remove: () => client.from('events').delete().eq('id', event).select(),
          },
          event_responses: {
            select: () => client.from('event_responses').select('*'),
            insert: () =>
              client
                .from('event_responses')
                .insert({ event_id: event, user_id: viewer, response: 'available' })
                .select(),
            update: () =>
              client
                .from('event_responses')
                .update({ response: 'unavailable' })
                .eq('event_id', event)
                .select(),
            remove: () => client.from('event_responses').delete().eq('event_id', event).select(),
          },
          attendance: {
            select: () => client.from('attendance').select('*'),
            insert: () =>
              client
                .from('attendance')
                .insert({ event_id: event, user_id: viewer, attended: true })
                .select(),
            update: () =>
              client.from('attendance').update({ attended: false }).eq('event_id', event).select(),
            remove: () => client.from('attendance').delete().eq('event_id', event).select(),
          },
        }

        for (const t of TABLES) {
          const a = attempts[t]
          expect(refusedOrEmpty(await a.select()), `${label} select ${t}`).toBe(true)
          expect((await a.insert()).error?.code, `${label} insert ${t}`).toBe('42501')
          expect(refusedOrEmpty(await a.update()), `${label} update ${t}`).toBe(true)
          expect(refusedOrEmpty(await a.remove()), `${label} delete ${t}`).toBe(true)
        }
        // Nothing got through: the service role still sees exactly one row everywhere.
        for (const t of TABLES) {
          const { count: n } = await admin.from(t).select('*', { count: 'exact', head: true })
          expect(n, `${t} after ${label}`).toBe(1)
        }
        await client.auth.signOut()
      })
    }
  })
})

describe('triggers', () => {
  it('AC14 — updated_at advances on update, created_at does not, and only the three tables carry it', async () => {
    const { rows: trig } = await sql<{ tbl: string; tgname: string; before_update: boolean }>(
      `select tgrelid::regclass::text as tbl, tgname, (tgtype & 2) = 2 and (tgtype & 16) = 16 as before_update
       from pg_trigger where not tgisinternal and tgrelid in
         (select oid from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r')
       order by 1`,
    )
    expect(trig.map((r) => r.tbl)).toEqual(['attendance', 'event_responses', 'events'])
    for (const r of trig) expect(r.before_update, r.tgname).toBe(true)
    for (const t of TABLES) {
      const carries = (UPDATED_AT_TABLES as readonly string[]).includes(t)
      expect('updated_at' in COLUMNS[t], t).toBe(carries)
    }

    // Separate transactions: inside one, now() is frozen and the trigger could not be told apart
    // from the default.
    const team = (
      await sql<{ id: string }>(
        `insert into public.teams (name) values ('ac14-scratch') returning id`,
      )
    ).rows[0]?.id
    if (!team) throw new Error('scratch team did not insert')
    try {
      const inserted = await sql<{ id: string; created_at: Date; updated_at: Date }>(
        `insert into public.events (team_id, type, title, location, starts_at)
         values ($1, 'training', 'Training', 'Here', now()) returning id, created_at, updated_at`,
        [team],
      )
      const before = inserted.rows[0]
      if (!before) throw new Error('scratch event did not insert')
      expect(before.updated_at.getTime()).toBe(before.created_at.getTime())
      await new Promise((r) => setTimeout(r, 20))
      // The statement does not mention updated_at.
      const after = (
        await sql<{ created_at: Date; updated_at: Date }>(
          `update public.events set title = 'Moved' where id = $1 returning created_at, updated_at`,
          [before.id],
        )
      ).rows[0]
      expect(after?.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
      expect(after?.created_at.getTime()).toBe(before.created_at.getTime())
    } finally {
      await sql(`delete from public.events where team_id = $1`, [team])
      await sql(`delete from public.teams where id = $1`, [team])
    }
  })
})

describe('deletes', () => {
  it('AC15 — a team with any dependant row cannot be deleted', async () => {
    await rolledBack(async (c) => {
      const f = await fixtures(c)
      await expectSqlState(c, '23503', () =>
        c.query(`delete from public.teams where id = $1`, [f.t1]),
      )
      // A team with nothing hanging off it can.
      expect((await c.query(`delete from public.teams where id = $1`, [f.t2])).rowCount).toBe(1)
    })
  })

  it('AC16 — deleting an event cascades to its responses and attendance and nothing else', async () => {
    await rolledBack(async (c) => {
      const f = await fixtures(c)
      await c.query(`delete from public.events where id = $1`, [f.e1])
      expect(await count(c, 'event_responses', 'event_id = $1', [f.e1])).toBe(0)
      expect(await count(c, 'attendance', 'event_id = $1', [f.e1])).toBe(0)
      expect(await count(c, 'team_members', 'team_id = $1', [f.t1])).toBe(2)
    })
  })

  it('AC16 — deleting a profile removes their rows and nulls what they created or recorded', async () => {
    await rolledBack(async (c) => {
      const f = await fixtures(c)
      await c.query(
        `insert into public.event_responses (event_id, user_id, response) values ($1, $2, 'unavailable')`,
        [f.e1, f.u1],
      )
      // Through auth.users, the way an account actually goes (D4).
      await c.query(`delete from auth.users where id = $1`, [f.u1])
      expect(await count(c, 'profiles', 'id = $1', [f.u1])).toBe(0)
      expect(await count(c, 'team_members', 'user_id = $1', [f.u1])).toBe(0)
      expect(await count(c, 'event_responses', 'user_id = $1', [f.u1])).toBe(0)
      expect(await count(c, 'events', 'id = $1 and created_by is null', [f.e1])).toBe(1)
      expect(
        await count(c, 'attendance', 'event_id = $1 and user_id = $2 and recorded_by is null', [
          f.e1,
          f.u2,
        ]),
      ).toBe(1)
      expect(await count(c, 'team_invites', 'team_id = $1 and created_by is null', [f.t1])).toBe(1)
      expect(await count(c, 'reset_tokens', 'user_id = $1 and created_by is null', [f.u2])).toBe(1)
    })
  })
})
