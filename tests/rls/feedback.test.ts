// S12.1 — the feedback table (v1.2.0, W2). Insert-as-self, read-own, admin-read-all, admin-only
// resolve through resolve_feedback, and anon shut out. The reseed does not truncate feedback (the
// table postdates the seed), so this suite clears its own rows before and after.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deleteAllFeedback } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRlsDenied,
  expectRows,
  expectRpcError,
} from './helpers/expect.ts'

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

beforeAll(deleteAllFeedback)
afterAll(deleteAllFeedback)

describe('feedback — insert as self, read own, admin all, admin-only resolve (S12.1)', () => {
  it('a signed-in user files feedback as themselves', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRows(
      await aaron
        .from('feedback')
        .insert({ user_id: idOf('playerFirsts'), category: 'bug', message: 'it broke' })
        .select('id'),
      1,
    )
  })

  it('a user cannot file as someone else (W2)', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('feedback')
        .insert({ user_id: idOf('playerFirstsOther'), category: 'bug', message: 'forged' }),
    )
  })

  it('a user reads only their own feedback', async () => {
    const ben = await signInAs('playerFirstsOther')
    expect(
      (
        await ben
          .from('feedback')
          .insert({ user_id: idOf('playerFirstsOther'), category: 'idea', message: "ben's" })
      ).error,
    ).toBeNull()
    const aaron = await signInAs('playerFirsts')
    const rows = (await aaron.from('feedback').select('user_id')).data ?? []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.user_id === idOf('playerFirsts'))).toBe(true)
  })

  it('an admin reads every feedback row', async () => {
    const admin = await signInAs('admin')
    const all = await admin.from('feedback').select('id')
    // Aaron's and Ben's, at least.
    expect((all.data ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('a non-admin cannot resolve; an admin can, and it sticks', async () => {
    const admin = await signInAs('admin')
    const aaron = await signInAs('playerFirsts')
    const one = expectRows(await admin.from('feedback').select('id').limit(1), 1)
    const id = one[0]?.id ?? ''
    expectRpcError(await aaron.rpc('resolve_feedback', { p_id: id }), 'not_authorised')
    expect((await admin.rpc('resolve_feedback', { p_id: id })).error).toBeNull()
    const row = expectRows(await admin.from('feedback').select('status').eq('id', id), 1)
    expect(row[0]?.status).toBe('resolved')
  })

  it('anon cannot insert, read, or resolve feedback', async () => {
    expectRlsDenied(
      await anonClient()
        .from('feedback')
        .insert({ user_id: idOf('playerFirsts'), category: 'other', message: 'anon' }),
    )
    expectEmpty(await anonClient().from('feedback').select('id'))
    expectNoExecute(await anonClient().rpc('resolve_feedback', { p_id: ZERO_UUID }))
  })
})
