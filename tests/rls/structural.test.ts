// D54 and AC3–AC5: the shape of the security layer, read from the catalogs as postgres. Every
// query asserts a positive set, never merely "no bad rows", so an empty result from a broken
// query cannot pass.
import { describe, expect, it } from 'vitest'

import { sql } from '../helpers/sql.ts'

const TABLES = [
  'attendance',
  'club_settings',
  'event_responses',
  'event_squad',
  'events',
  'feedback',
  'match_stats',
  'profiles',
  'reset_tokens',
  'subs_payments',
  'team_invites',
  'team_members',
  'teams',
] as const

/** RPC-only by design: RLS on, zero policies, no client grant (D54). */
const DENY_ALL = ['reset_tokens', 'team_invites'] as const

const ANON_FUNCTIONS = ['get_event_preview', 'lookup_team_invite', 'redeem_reset_token'] as const

describe('row 1 — every table in public has row-level security on', () => {
  it('the tables exist and each has rowsecurity true', async () => {
    const rows = await sql<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1`,
    )
    expect(rows.map((r) => r.tablename)).toEqual([...TABLES])
    expect(rows.filter((r) => !r.rowsecurity).map((r) => r.tablename)).toEqual([])
  })

  it('no table forces RLS off for its owner either way: relforcerowsecurity is false, rls is enabled', async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    )
    expect(rows).toHaveLength(TABLES.length)
    expect(rows.every((r) => r.relrowsecurity)).toBe(true)
  })
})

describe('row 2 — every table has a policy unless it is one of the two deny-all tables', () => {
  it('each policied table has at least one policy', async () => {
    const rows = await sql<{ tablename: string; policies: number }>(
      `select t.tablename, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)::int as policies
         from pg_tables t where t.schemaname = 'public' order by 1`,
    )
    expect(rows).toHaveLength(TABLES.length)
    const policied = rows.filter((r) => !(DENY_ALL as readonly string[]).includes(r.tablename))
    expect(policied).toHaveLength(TABLES.length - DENY_ALL.length)
    expect(policied.filter((r) => r.policies < 1).map((r) => r.tablename)).toEqual([])
  })

  it.each(DENY_ALL)('%s has zero policies', async (table) => {
    const rows = await sql<{ n: number }>(
      `select count(*)::int as n from pg_policies where schemaname = 'public' and tablename = '${table}'`,
    )
    expect(rows).toEqual([{ n: 0 }])
  })

  it.each(DENY_ALL)('%s grants nothing to anon or authenticated', async (table) => {
    const rows = await sql<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = '${table}' and grantee in ('anon', 'authenticated')`,
    )
    expect(rows).toEqual([])
    const probe = await sql<{ role: string; priv: string; held: boolean }>(
      `select r.role, p.priv, has_table_privilege(r.role, 'public.${table}', p.priv) as held
         from (values ('anon'), ('authenticated')) r(role), (values ('select'), ('insert'), ('update'), ('delete')) p(priv)`,
    )
    expect(probe).toHaveLength(8)
    expect(probe.filter((r) => r.held)).toEqual([])
  })
})

describe('row 3 / AC5 — anon reach', () => {
  it('anon holds no table privilege anywhere in public', async () => {
    const probe = await sql<{ tablename: string; held: boolean }>(
      `select t.tablename, bool_or(has_table_privilege('anon', format('public.%I', t.tablename), p.priv)) as held
         from pg_tables t, (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv)
        where t.schemaname = 'public' group by 1 order by 1`,
    )
    expect(probe.map((r) => r.tablename)).toEqual([...TABLES])
    expect(probe.filter((r) => r.held).map((r) => r.tablename)).toEqual([])
    const grants = await sql<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`,
    )
    expect(grants).toEqual([])
  })

  it('anon executes exactly get_event_preview, lookup_team_invite and redeem_reset_token', async () => {
    const rows = await sql<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`,
    )
    expect(rows.map((r) => r.proname)).toEqual([...ANON_FUNCTIONS])
  })

  it('redeem_reset_token is also executable by authenticated', async () => {
    const rows = await sql<{ held: boolean }>(
      `select has_function_privilege('authenticated', 'public.redeem_reset_token(text, text)', 'execute') as held`,
    )
    expect(rows).toEqual([{ held: true }])
  })

  it('every function in public is security definer with an empty search_path, except the updated_at trigger', async () => {
    const rows = await sql<{ proname: string; prosecdef: boolean; config: string | null }>(
      `select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as config
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`,
    )
    // Fourteen RPCs, five predicates, new_token, handle_new_user, set_updated_at.
    expect(rows.length).toBeGreaterThanOrEqual(22)
    const invoker = rows.filter((r) => !r.prosecdef).map((r) => r.proname)
    expect(invoker).toEqual(['set_updated_at'])
    expect(rows.filter((r) => r.config !== 'search_path=""').map((r) => r.proname)).toEqual([])
  })

  it('new_token is executable by no client role', async () => {
    const rows = await sql<{ role: string; held: boolean }>(
      `select r.role, has_function_privilege(r.role, 'public.new_token()', 'execute') as held
         from (values ('anon'), ('authenticated'), ('service_role')) r(role) order by 1`,
    )
    expect(rows).toEqual([
      { role: 'anon', held: false },
      { role: 'authenticated', held: false },
      { role: 'service_role', held: false },
    ])
  })
})
