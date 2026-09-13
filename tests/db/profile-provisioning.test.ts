// S1.2 — the profile trigger, through the real auth endpoints: anon-key signUp for what a
// browser does, the admin API for the fallback path and for cleanup. Every account created here
// is deleted again, so the seed counts in seed.test.ts stay exact. Numbers are +3538999988NN:
// outside the seed's +353899999 block and the E2E +3538990 range (D58).
import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { adminClient, createUser, deleteUser } from '../helpers/admin.ts'
import { anonClient, signedInClient } from '../helpers/local.ts'
import { lit, scalar, sql } from '../helpers/sql.ts'

const PASSWORD = 'throwaway-pass-1234'
const PHONES = {
  plain: '+353899998801',
  noName: '+353899998802',
  blankName: '+353899998803',
  sneaky: '+353899998804',
  fallback: '+353899998805',
  cascadeA: '+353899998806',
  cascadeB: '+353899998807',
} as const
const FALLBACK_EMAIL = 's12-fallback@phibsboro.invalid'
const FALLBACK_DUP_EMAIL = 's12-fallback-dup@phibsboro.invalid'
const FALLBACK_BAD_EMAIL = 's12-fallback-bad@phibsboro.invalid'

const admin = adminClient()
const created: string[] = []
const track = (id: string) => {
  created.push(id)
  return id
}

/** What supabase-js hands the client. Printed for the AC10 mapping table. */
const payload = (error: { status?: number; code?: string; name: string; message: string }) => ({
  status: error.status,
  code: error.code,
  name: error.name,
  message: error.message,
})

const authUsers = () => scalar('select count(*) from auth.users')
const profilesFor = (phone: string) =>
  scalar(`select count(*) from public.profiles where phone = ${lit(phone)}`)

async function profile(id: string) {
  const { data, error } = await admin.from('profiles').select('*').eq('id', id)
  if (error) throw new Error(error.message)
  return data[0]
}

afterEach(async () => {
  for (const id of created.splice(0)) await deleteUser(id)
})

afterAll(async () => {
  // Belt and braces: anything a failed assertion left behind in this file's ranges.
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const user of data.users) {
    if (
      (user.phone ?? '').startsWith('3538999988') ||
      (user.email ?? '').endsWith('@phibsboro.invalid')
    ) {
      await deleteUser(user.id)
    }
  }
})

describe('AC5, AC6 — signUp creates exactly one profile', () => {
  it('same id, trimmed name, + prefixed phone, is_admin false, created_at set', async () => {
    const { data, error } = await anonClient().auth.signUp({
      phone: PHONES.plain,
      password: PASSWORD,
      options: { data: { name: '  Spike User  ' } },
    })
    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    const user = data.user
    if (!user) throw new Error('no user')
    track(user.id)

    // GoTrue stores the number without the + (D35); the trigger puts it back.
    expect(user.phone).toBe(PHONES.plain.slice(1))

    const row = await profile(user.id)
    expect(row).toMatchObject({
      id: user.id,
      name: 'Spike User',
      phone: PHONES.plain,
      is_admin: false,
    })
    expect(row?.created_at).toBeTruthy()
    expect(await profilesFor(PHONES.plain)).toBe(1)
  })

  it('a phone that fails the E.164 check leaves no auth user behind', async () => {
    const before = await authUsers()
    // auth.users.phone empty, so the trigger reads metadata: an 08 number is not E.164.
    const { data, error } = await admin.auth.admin.createUser({
      email: FALLBACK_BAD_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Bad Number', phone: '0871234567' },
    })
    if (data.user) track(data.user.id)
    expect(error).not.toBeNull()
    console.log('AC10 profile_phone_invalid (admin createUser):', payload(error as never))
    expect(await authUsers()).toBe(before)
  })
})

describe('AC7 — a signup without a name is refused whole', () => {
  it.each([
    ['no name', undefined, PHONES.noName],
    ['whitespace name', '   ', PHONES.blankName],
  ])('%s: error, and auth.users count unchanged', async (_label, name, phone) => {
    const before = await authUsers()
    const { data, error } = await anonClient().auth.signUp({
      phone,
      password: PASSWORD,
      options: name === undefined ? undefined : { data: { name } },
    })
    if (data.user) track(data.user.id)
    expect(error).not.toBeNull()
    console.log(`AC10 profile_name_required (${_label}):`, payload(error as never))
    expect(await authUsers()).toBe(before)
    expect(await profilesFor(phone)).toBe(0)
  })
})

describe('AC8, AC9 — one account per number', () => {
  it('a second signUp with the same number is refused with a known code', async () => {
    track(await createUser(PHONES.plain, PASSWORD, 'First Holder'))
    const before = await authUsers()

    const { data, error } = await anonClient().auth.signUp({
      phone: PHONES.plain,
      password: 'another-pass-1234',
      options: { data: { name: 'Second Holder' } },
    })
    if (data.user && !created.includes(data.user.id)) track(data.user.id)
    expect(error).not.toBeNull()
    console.log('AC10 duplicate number (signUp):', payload(error as never))
    // GoTrue refuses before the trigger runs. Measured: user_already_exists, not phone_exists.
    expect(error?.status).toBe(422)
    expect(['user_already_exists', 'phone_exists']).toContain(error?.code)
    expect(data.user).toBeNull()

    expect(await authUsers()).toBe(before)
    expect(await profilesFor(PHONES.plain)).toBe(1)
  })

  it('under the metadata fallback the trigger itself refuses a taken number (phone_taken)', async () => {
    track(await createUser(PHONES.plain, PASSWORD, 'First Holder'))
    const before = await authUsers()
    const { data, error } = await admin.auth.admin.createUser({
      email: FALLBACK_DUP_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Squatter', phone: PHONES.plain },
    })
    if (data.user) track(data.user.id)
    expect(error).not.toBeNull()
    console.log('AC10 phone_taken (admin createUser, metadata phone):', payload(error as never))
    expect(await authUsers()).toBe(before)
    expect(await profilesFor(PHONES.plain)).toBe(1)
  })
})

describe('AC11 — the trigger function', () => {
  it('is security definer, search_path empty, owned by postgres, after insert on auth.users', async () => {
    const [fn] = await sql<{ prosecdef: boolean; proconfig: string[] | null; owner: string }>(
      `select p.prosecdef, p.proconfig, r.rolname as owner
         from pg_proc p
         join pg_roles r on r.oid = p.proowner
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'handle_new_user'`,
    )
    expect(fn).toMatchObject({ prosecdef: true, owner: 'postgres' })
    expect(fn?.proconfig).toEqual(['search_path=""'])

    const [trigger] = await sql<{ tgname: string; tgtype: number; tgenabled: string }>(
      `select tgname, tgtype, tgenabled from pg_trigger
        where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'`,
    )
    expect(trigger?.tgenabled).toBe('O')
    // tgtype bits: 1 row, 2 before, 4 insert. 5 = after insert, for each row.
    expect(Number(trigger?.tgtype)).toBe(5)
  })

  it('no client can insert a profile: anon and a signed-in user are both refused', async () => {
    const id = track(await createUser(PHONES.plain, PASSWORD, 'Holder'))
    const attempt = { id: crypto.randomUUID(), name: 'Forged', phone: '+353899998899' }
    const anon = await anonClient().from('profiles').insert(attempt)
    expect(anon.error?.code).toBe('42501')
    const signedIn = await signedInClient(PHONES.plain, PASSWORD)
    const own = await signedIn.from('profiles').insert(attempt)
    expect(own.error?.code).toBe('42501')
    expect(await profilesFor(attempt.phone)).toBe(0)
    expect(await profile(id)).toBeDefined()
  })
})

describe('AC12 — is_admin cannot come from signup', () => {
  it('metadata is_admin: true still produces is_admin false', async () => {
    const { data, error } = await anonClient().auth.signUp({
      phone: PHONES.sneaky,
      password: PASSWORD,
      options: { data: { name: 'Sneaky', is_admin: true } },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('no user')
    track(data.user.id)
    expect((await profile(data.user.id))?.is_admin).toBe(false)
  })
})

describe('AC13 — deleting the auth user cascades through profiles', () => {
  it('removes memberships, responses and attendance; nulls created_by and recorded_by', async () => {
    const a = track(await createUser(PHONES.cascadeA, PASSWORD, 'Leaving'))
    const b = track(await createUser(PHONES.cascadeB, PASSWORD, 'Staying'))
    const teamName = 'S1.2 cascade fixture'
    const { data: team, error: teamError } = await admin
      .from('teams')
      .insert({ name: teamName })
      .select('id')
      .single()
    if (teamError) throw new Error(teamError.message)
    try {
      const fail = (e: { message: string } | null) => {
        if (e) throw new Error(e.message)
      }
      fail((await admin.from('team_members').insert({ team_id: team.id, user_id: a })).error)
      const { data: event, error: eventError } = await admin
        .from('events')
        .insert({
          team_id: team.id,
          type: 'training',
          title: 'Training',
          location: 'Somewhere',
          starts_at: new Date(Date.now() - 86_400_000).toISOString(),
          created_by: a,
        })
        .select('id')
        .single()
      fail(eventError)
      if (!event) throw new Error('no event')
      fail(
        (
          await admin
            .from('event_responses')
            .insert({ event_id: event.id, user_id: a, response: 'available' })
        ).error,
      )
      fail(
        (
          await admin.from('attendance').insert([
            { event_id: event.id, user_id: a, attended: true, recorded_by: b },
            { event_id: event.id, user_id: b, attended: true, recorded_by: a },
          ])
        ).error,
      )

      await deleteUser(a)
      created.splice(created.indexOf(a), 1)

      expect(await profile(a)).toBeUndefined()
      const rows = async (table: 'team_members' | 'event_responses' | 'attendance') =>
        (await admin.from(table).select('user_id').eq('user_id', a)).data?.length
      expect(await rows('team_members')).toBe(0)
      expect(await rows('event_responses')).toBe(0)
      expect(await rows('attendance')).toBe(0)

      const { data: survivingEvent } = await admin
        .from('events')
        .select('id, created_by')
        .eq('id', event.id)
        .single()
      expect(survivingEvent).toEqual({ id: event.id, created_by: null })

      const { data: bAttendance } = await admin
        .from('attendance')
        .select('recorded_by, attended')
        .eq('event_id', event.id)
        .eq('user_id', b)
        .single()
      expect(bAttendance).toEqual({ recorded_by: null, attended: true })
    } finally {
      await admin.from('events').delete().eq('team_id', team.id)
      await admin.from('teams').delete().eq('id', team.id)
    }
  })
})

describe('AC14 — metadata phone fallback', () => {
  it('reads the number from raw_user_meta_data when auth.users.phone is empty', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: FALLBACK_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Fallback', phone: PHONES.fallback },
    })
    expect(error).toBeNull()
    if (!data.user) throw new Error('no user')
    track(data.user.id)
    expect(await profile(data.user.id)).toMatchObject({
      name: 'Fallback',
      phone: PHONES.fallback,
      is_admin: false,
    })
  })
})
