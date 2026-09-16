// S18.1 — set_response_for. A manager (or admin) records a player's availability on their behalf
// through this security-definer RPC; the event_responses table policies stay player-only, so this
// is a manager's only way to write another player's row. A non-manager is refused, the write closes
// at kick-off (the same D12 window the player's own policy enforces), and the subject must be a
// member of the event's team.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createThrowaway, deleteThrowaway, insertMembership } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS } from './helpers/fixtures.ts'
import { expectNoExecute, expectRows, expectRpcError } from './helpers/expect.ts'

// A Firsts player the manager answers for; created here so the row it gains is isolated and
// cascades away with the account, never touching a seeded player other tests rely on.
let subject = { id: '', phone: '', password: '' }

beforeAll(async () => {
  subject = await createThrowaway(6, 'On Behalf')
  await insertMembership({ team_id: FIRSTS, user_id: subject.id, role: 'player' })
})

afterAll(async () => {
  if (subject.id) await deleteThrowaway(subject.id)
})

describe('set_response_for (S18.1)', () => {
  it('a manager sets an awaiting player available, then updates it — one row, idempotent', async () => {
    const manager = await signInAs('managerFirsts')
    const match = { event_id: EVENT.firsts.far.id, user_id: subject.id }

    const up = await manager.rpc('set_response_for', {
      p_event_id: EVENT.firsts.far.id,
      p_user_id: subject.id,
      p_response: 'available',
    })
    expect(up.error).toBeNull()
    expect(
      expectRows(await manager.from('event_responses').select('response').match(match), 1)[0],
    ).toEqual({ response: 'available' })

    const flip = await manager.rpc('set_response_for', {
      p_event_id: EVENT.firsts.far.id,
      p_user_id: subject.id,
      p_response: 'unavailable',
      p_reason: 'Away with work', // mandatory for unavailable (S18.4)
    })
    expect(flip.error).toBeNull()
    // Still one row (upsert on the PK), now the new value plus the reason.
    expect(
      expectRows(
        await manager.from('event_responses').select('response, reason').match(match),
        1,
      )[0],
    ).toEqual({ response: 'unavailable', reason: 'Away with work' })
  })

  it('refuses to mark unavailable without a reason (S18.4 check)', async () => {
    const manager = await signInAs('admin')
    // No p_reason → the DB check rejects it (a constraint error, not one of the RPC words).
    const res = await manager.rpc('set_response_for', {
      p_event_id: EVENT.firsts.far.id,
      p_user_id: subject.id,
      p_response: 'unavailable',
    })
    expect(res.error).not.toBeNull()
  })

  it('a plain player cannot set anyone else on their behalf', async () => {
    const player = await signInAs('playerFirsts')
    expectRpcError(
      await player.rpc('set_response_for', {
        p_event_id: EVENT.firsts.far.id,
        p_user_id: subject.id,
        p_response: 'available',
      }),
      'not_authorised',
    )
  })

  it('refuses once the window has closed — a past or cancelled event', async () => {
    const manager = await signInAs('managerFirsts')
    for (const eventId of [EVENT.firsts.past.id, EVENT.firsts.cancelled.id]) {
      expectRpcError(
        await manager.rpc('set_response_for', {
          p_event_id: eventId,
          p_user_id: subject.id,
          p_response: 'available',
        }),
        'not_authorised',
      )
    }
  })

  it('refuses a subject who is not a member of the event’s team', async () => {
    const manager = await signInAs('managerFirsts')
    expectRpcError(
      await manager.rpc('set_response_for', {
        p_event_id: EVENT.firsts.far.id,
        p_user_id: idOf('stranger'),
        p_response: 'available',
      }),
      'not_authorised',
    )
  })

  it('anon holds no execute on the function', async () => {
    expectNoExecute(
      await anonClient().rpc('set_response_for', {
        p_event_id: EVENT.firsts.far.id,
        p_user_id: subject.id,
        p_response: 'available',
      }),
    )
  })
})
