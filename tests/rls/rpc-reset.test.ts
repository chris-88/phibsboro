// Rows 32 and 33: issue_reset_token and redeem_reset_token (D10, D11, D27). A manager resets
// players on their teams and nobody else; a reset link is single use, 24 hours, and ends every
// session the account had. Victims are throwaway accounts so no seeded session is ever broken.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createThrowaway,
  deleteAllResetTokens,
  deleteThrowaway,
  expireResetToken,
  insertMembership,
} from './helpers/arrange.ts'
import { anonClient, idOf, signInAs, signInWith } from './helpers/clients.ts'
import { FIRSTS, SECONDS } from './helpers/fixtures.ts'
import { expectRpcError, expectTokenShape } from './helpers/expect.ts'

let victim = { id: '', phone: '', password: '' }
let coManager = { id: '', phone: '', password: '' }

beforeAll(async () => {
  victim = await createThrowaway(1, 'Reset Victim')
  coManager = await createThrowaway(2, 'Co Manager')
  await insertMembership({ team_id: FIRSTS, user_id: victim.id, role: 'player' })
  await insertMembership({ team_id: FIRSTS, user_id: coManager.id, role: 'manager' })
})

afterAll(async () => {
  await deleteAllResetTokens()
  if (victim.id) await deleteThrowaway(victim.id)
  if (coManager.id) await deleteThrowaway(coManager.id)
})

const issue = async (as: Parameters<typeof signInAs>[0], userId: string, teamId: string) =>
  (await signInAs(as)).rpc('issue_reset_token', { p_user_id: userId, p_team_id: teamId })

describe('row 32 — issue_reset_token', () => {
  it('manager issues for a player on their team: a 43-character token, different each time', async () => {
    const first = await issue('managerFirsts', victim.id, FIRSTS)
    const second = await issue('managerFirsts', victim.id, FIRSTS)
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expectTokenShape(first.data)
    expectTokenShape(second.data)
    expect(first.data).not.toBe(second.data)
    // The second issue revoked the first, which now fails to redeem.
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: first.data,
        p_new_password: 'new-password-1234',
      }),
      'invalid_token',
    )
  })

  it('admin issues for a manager', async () => {
    const res = await issue('admin', idOf('managerSeconds'), SECONDS)
    expect(res.error).toBeNull()
    expectTokenShape(res.data)
  })

  it('manager targeting a co-manager raises not_authorised', async () => {
    expectRpcError(await issue('managerFirsts', coManager.id, FIRSTS), 'not_authorised')
    expectRpcError(await issue('managerFirsts', idOf('managerFirsts'), FIRSTS), 'not_authorised')
  })

  it('manager targeting an admin raises not_authorised', async () => {
    expectRpcError(await issue('managerFirsts', idOf('admin'), FIRSTS), 'not_authorised')
  })

  it('manager targeting a player on another team raises not_authorised', async () => {
    expectRpcError(await issue('managerFirsts', idOf('playerSeconds'), FIRSTS), 'not_authorised')
    expectRpcError(await issue('managerFirsts', idOf('playerSeconds'), SECONDS), 'not_authorised')
  })

  it('manager targeting a player who manages elsewhere raises not_authorised', async () => {
    // Declan plays for Seconds and manages Firsts; Niamh manages Seconds.
    expectRpcError(await issue('managerSeconds', idOf('managerFirsts'), SECONDS), 'not_authorised')
  })

  it('player and stranger raise not_authorised; anon cannot execute', async () => {
    expectRpcError(await issue('playerFirsts', victim.id, FIRSTS), 'not_authorised')
    expectRpcError(await issue('playerFirsts', idOf('playerFirsts'), FIRSTS), 'not_authorised')
    expectRpcError(await issue('stranger', victim.id, FIRSTS), 'not_authorised')
    const anon = await anonClient().rpc('issue_reset_token', {
      p_user_id: victim.id,
      p_team_id: FIRSTS,
    })
    expect(anon.error?.code).toBe('42501')
  })

  it('admin targeting a non-existent user or team raises not_authorised, not a constraint name', async () => {
    const res = await issue('admin', '00000000-0000-4000-8000-00000000dead', FIRSTS)
    expectRpcError(res, 'not_authorised')
    expectRpcError(
      await issue('admin', victim.id, '00000000-0000-4000-8000-00000000dead'),
      'not_authorised',
    )
  })
})

describe('row 33 — redeem_reset_token', () => {
  const NEW_PASSWORD = 'reset-password-5678'

  it('anon redeems, the returned phone and new password sign in, and the old session is dead', async () => {
    // The victim is signed in on a phone somewhere.
    const before = await signInWith(victim.phone, victim.password)
    const oldRefresh = (await before.auth.getSession()).data.session?.refresh_token
    expect(oldRefresh).toBeTruthy()

    const issued = await issue('managerFirsts', victim.id, FIRSTS)
    expectTokenShape(issued.data)

    const { data, error } = await anonClient().rpc('redeem_reset_token', {
      p_token: issued.data,
      p_new_password: NEW_PASSWORD,
    })
    expect(error).toBeNull()
    expect(data).toBe(victim.phone)

    const after = await signInWith(victim.phone, NEW_PASSWORD)
    expect((await after.auth.getUser()).data.user?.id).toBe(victim.id)

    const old = await anonClient().auth.signInWithPassword({
      phone: victim.phone,
      password: victim.password,
    })
    expect(old.error?.code).toBe('invalid_credentials')

    const refreshed = await anonClient().auth.refreshSession({ refresh_token: oldRefresh ?? '' })
    expect(refreshed.error).not.toBeNull()
    expect(refreshed.data.session).toBeNull()
    victim.password = NEW_PASSWORD
  })

  it('reuse of a redeemed token raises invalid_token', async () => {
    const issued = await issue('managerFirsts', victim.id, FIRSTS)
    expectTokenShape(issued.data)
    const first = await anonClient().rpc('redeem_reset_token', {
      p_token: issued.data,
      p_new_password: 'another-pass-9',
    })
    expect(first.error).toBeNull()
    victim.password = 'another-pass-9'
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: issued.data,
        p_new_password: 'yet-another-pass',
      }),
      'invalid_token',
    )
  })

  it('expired token raises invalid_token', async () => {
    const issued = await issue('managerFirsts', victim.id, FIRSTS)
    expectTokenShape(issued.data)
    await expireResetToken(issued.data)
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: issued.data,
        p_new_password: 'expired-pass-1',
      }),
      'invalid_token',
    )
  })

  it('revoked token raises invalid_token', async () => {
    const stale = await issue('managerFirsts', victim.id, FIRSTS)
    const fresh = await issue('managerFirsts', victim.id, FIRSTS)
    expectTokenShape(stale.data)
    expectTokenShape(fresh.data)
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: stale.data,
        p_new_password: 'revoked-pass-1',
      }),
      'invalid_token',
    )
  })

  it('unknown token raises invalid_token', async () => {
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: 'x'.repeat(43),
        p_new_password: 'unknown-pass-1',
      }),
      'invalid_token',
    )
  })

  it('a 7-character password raises invalid_token and leaves the token live', async () => {
    const issued = await issue('managerFirsts', victim.id, FIRSTS)
    expectTokenShape(issued.data)
    expectRpcError(
      await anonClient().rpc('redeem_reset_token', {
        p_token: issued.data,
        p_new_password: '1234567',
      }),
      'invalid_token',
    )
    // Still redeemable with a long enough password: the short one consumed nothing.
    const ok = await anonClient().rpc('redeem_reset_token', {
      p_token: issued.data,
      p_new_password: 'eight-ok',
    })
    expect(ok.error).toBeNull()
    victim.password = 'eight-ok'
  })

  it('a signed-in visitor can redeem a link: the token, not the session, authorises it', async () => {
    const issued = await issue('admin', victim.id, FIRSTS)
    expectTokenShape(issued.data)
    const aaron = await signInAs('playerFirsts')
    const { data, error } = await aaron.rpc('redeem_reset_token', {
      p_token: issued.data,
      p_new_password: 'visitor-pass-1',
    })
    expect(error).toBeNull()
    expect(data).toBe(victim.phone)
    victim.password = 'visitor-pass-1'
    // Aaron's own session is untouched.
    expect((await aaron.auth.getUser()).data.user?.id).toBe(idOf('playerFirsts'))
  })

  it('admin redeems a link they issued, and it is the victim whose password moves (row 40)', async () => {
    const admin = await signInAs('admin')
    const issued = await admin.rpc('issue_reset_token', { p_user_id: victim.id, p_team_id: FIRSTS })
    expectTokenShape(issued.data)
    const { data, error } = await admin.rpc('redeem_reset_token', {
      p_token: issued.data,
      p_new_password: 'admin-redeemed-1',
    })
    expect(error).toBeNull()
    expect(data).toBe(victim.phone)
    victim.password = 'admin-redeemed-1'
    const moved = await signInWith(victim.phone, victim.password)
    expect((await moved.auth.getUser()).data.user?.id).toBe(victim.id)
    // The admin's own session is untouched.
    expect((await admin.auth.getUser()).data.user?.id).toBe(idOf('admin'))
  })
})
