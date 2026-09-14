// Service-role writes for arrange and teardown steps: the state a test needs that no role can
// create through the anon key, and the cleanup that leaves the database as the seed made it
// (AC13). Writes only. Nothing here reads, so nothing here can end up inside an assertion (AC8);
// the two sanctioned re-reads live in expect.ts.
import type { Database } from '../../../src/lib/database.types.ts'
import { adminClient, createUser, deleteUser } from '../../helpers/admin.ts'
import { THROWAWAY_PASSWORD, THROWAWAY_PREFIX } from './fixtures.ts'

type Tables = Database['public']['Tables']
type Insert<T extends keyof Tables> = Tables[T]['Insert']

const admin = adminClient()

const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`arrange ${what}: ${error.message}`)
}

export async function setTeamActive(teamId: string, active: boolean) {
  check((await admin.from('teams').update({ active }).eq('id', teamId)).error, 'setTeamActive')
}

export async function deleteTeam(id: string) {
  check((await admin.from('teams').delete().eq('id', id)).error, 'deleteTeam')
}

export async function insertMembership(row: Insert<'team_members'>) {
  check((await admin.from('team_members').insert(row)).error, 'insertMembership')
}

export async function deleteMembership(teamId: string, userId: string) {
  check(
    (await admin.from('team_members').delete().match({ team_id: teamId, user_id: userId })).error,
    'deleteMembership',
  )
}

export async function insertEvent(row: Insert<'events'>) {
  check((await admin.from('events').insert(row)).error, 'insertEvent')
}

export async function deleteEvent(id: string) {
  check((await admin.from('events').delete().eq('id', id)).error, 'deleteEvent')
}

/** Every event created by a generate_training_series run. */
export async function deleteSeries(seriesId: string) {
  check((await admin.from('events').delete().eq('series_id', seriesId)).error, 'deleteSeries')
}

export async function insertResponse(row: Insert<'event_responses'>) {
  check((await admin.from('event_responses').insert(row)).error, 'insertResponse')
}

export async function deleteResponse(eventId: string, userId: string) {
  check(
    (await admin.from('event_responses').delete().match({ event_id: eventId, user_id: userId }))
      .error,
    'deleteResponse',
  )
}

export async function setResponse(
  eventId: string,
  userId: string,
  response: 'available' | 'unavailable',
) {
  check(
    (
      await admin
        .from('event_responses')
        .update({ response })
        .match({ event_id: eventId, user_id: userId })
    ).error,
    'setResponse',
  )
}

export async function insertSquad(row: Insert<'event_squad'>) {
  check((await admin.from('event_squad').insert(row)).error, 'insertSquad')
}

export async function deleteSquad(eventId: string, userId: string) {
  check(
    (await admin.from('event_squad').delete().match({ event_id: eventId, user_id: userId })).error,
    'deleteSquad',
  )
}

/** Every squad row. The seed creates none, so this restores the seeded state (0 rows). */
export async function deleteAllSquad() {
  check(
    (await admin.from('event_squad').delete().not('event_id', 'is', null)).error,
    'deleteAllSquad',
  )
}

export async function insertAttendance(row: Insert<'attendance'>) {
  check((await admin.from('attendance').insert(row)).error, 'insertAttendance')
}

export async function deleteAttendance(eventId: string, userId: string) {
  check(
    (await admin.from('attendance').delete().match({ event_id: eventId, user_id: userId })).error,
    'deleteAttendance',
  )
}

/** Backdates a live invite so it reads as expired. */
export async function expireInvite(token: string) {
  const expires_at = new Date(Date.now() - 3_600_000).toISOString()
  check(
    (await admin.from('team_invites').update({ expires_at }).eq('token', token)).error,
    'expireInvite',
  )
}

/** Every invite, live or not. The seed creates none, so this restores the seeded state. */
export async function deleteAllInvites() {
  check((await admin.from('team_invites').delete().not('id', 'is', null)).error, 'deleteAllInvites')
}

/** Backdates a reset token so it reads as expired. */
export async function expireResetToken(token: string) {
  const expires_at = new Date(Date.now() - 3_600_000).toISOString()
  check(
    (await admin.from('reset_tokens').update({ expires_at }).eq('token', token)).error,
    'expireResetToken',
  )
}

/** Every reset token. The seed creates none. */
export async function deleteAllResetTokens() {
  check(
    (await admin.from('reset_tokens').delete().not('id', 'is', null)).error,
    'deleteAllResetTokens',
  )
}

/**
 * A confirmed phone + password account in the suite's own number range, created through the
 * Auth admin API as the seed does. `n` picks the number; keep it unique within a file. Returns
 * the id; deleteThrowaway removes the account and everything under it (D4).
 */
export async function createThrowaway(n: number, name = 'Throwaway') {
  const phone = throwawayPhone(n)
  const id = await createUser(phone, THROWAWAY_PASSWORD, name)
  return { id, phone, password: THROWAWAY_PASSWORD }
}

export const throwawayPhone = (n: number) => `${THROWAWAY_PREFIX}${String(n)}`

export async function deleteThrowaway(id: string) {
  await deleteUser(id)
}
