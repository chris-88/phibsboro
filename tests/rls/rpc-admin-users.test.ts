// S18.2 — admin_set_admin and admin_delete_user. Two admin-only RPCs the user manager gained:
// promote/demote another admin (profiles.is_admin, which is_admin() reads), and fully delete a
// person (auth.users, cascading to their profile and every row keyed on it). Both refuse a
// non-admin and a self-action; anon holds no execute.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createThrowaway, deleteThrowaway } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { expectNoExecute, expectRowAbsent, expectRows, expectRpcError } from './helpers/expect.ts'

// A throwaway the admin promotes/demotes; cascades away with the account in afterAll.
let promotable = { id: '', phone: '', password: '' }

beforeAll(async () => {
  promotable = await createThrowaway(7, 'Promotable')
})

afterAll(async () => {
  if (promotable.id) await deleteThrowaway(promotable.id)
})

describe('admin_set_admin (S18.2)', () => {
  it('an admin promotes then demotes another user', async () => {
    const admin = await signInAs('admin')
    const up = await admin.rpc('admin_set_admin', { p_user_id: promotable.id, p_is_admin: true })
    expect(up.error).toBeNull()
    expect(
      expectRows(await admin.from('profiles').select('is_admin').eq('id', promotable.id), 1)[0],
    ).toEqual({ is_admin: true })

    const down = await admin.rpc('admin_set_admin', { p_user_id: promotable.id, p_is_admin: false })
    expect(down.error).toBeNull()
    expect(
      expectRows(await admin.from('profiles').select('is_admin').eq('id', promotable.id), 1)[0],
    ).toEqual({ is_admin: false })
  })

  it('an admin cannot strip their own admin', async () => {
    const admin = await signInAs('admin')
    expectRpcError(
      await admin.rpc('admin_set_admin', { p_user_id: idOf('admin'), p_is_admin: false }),
      'not_authorised',
    )
  })

  it('a non-admin cannot promote anyone', async () => {
    const manager = await signInAs('managerFirsts')
    expectRpcError(
      await manager.rpc('admin_set_admin', { p_user_id: promotable.id, p_is_admin: true }),
      'not_authorised',
    )
  })

  it('anon holds no execute', async () => {
    expectNoExecute(
      await anonClient().rpc('admin_set_admin', { p_user_id: promotable.id, p_is_admin: true }),
    )
  })
})

describe('admin_delete_user (S18.2)', () => {
  it('an admin cannot delete their own account', async () => {
    const admin = await signInAs('admin')
    expectRpcError(
      await admin.rpc('admin_delete_user', { p_user_id: idOf('admin') }),
      'not_authorised',
    )
  })

  it('a non-admin cannot delete anyone', async () => {
    const player = await signInAs('playerFirsts')
    expectRpcError(
      await player.rpc('admin_delete_user', { p_user_id: promotable.id }),
      'not_authorised',
    )
  })

  it('anon holds no execute', async () => {
    expectNoExecute(await anonClient().rpc('admin_delete_user', { p_user_id: promotable.id }))
  })

  it('an admin deletes a person and their profile cascades away', async () => {
    const deletable = await createThrowaway(8, 'Deletable')
    const admin = await signInAs('admin')
    const res = await admin.rpc('admin_delete_user', { p_user_id: deletable.id })
    expect(res.error).toBeNull()
    // The profile is gone — proof the auth account and its cascade were removed.
    await expectRowAbsent('profiles', { id: deletable.id })
  })
})
