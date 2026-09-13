import type { PostgrestError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The client is the boundary; everything above it is what this test proves.
const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const { callRpc } = await import('@/api/rpc')
const { AppError } = await import('@/lib/errors')

const pgError = (message: string): PostgrestError =>
  ({ message, code: 'P0001', details: '', hint: '', name: 'PostgrestError' }) as PostgrestError

describe('callRpc (AC8, AC9)', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('passes the function name and typed arguments straight through and returns data', async () => {
    rpc.mockResolvedValue({ data: [{ team_id: 't', team_name: 'Firsts' }], error: null })
    const rows = await callRpc('join_team_by_event', { p_event_id: 'e' })
    expect(rpc).toHaveBeenCalledWith('join_team_by_event', { p_event_id: 'e' })
    expect(rows).toEqual([{ team_id: 't', team_name: 'Firsts' }])
  })

  it('throws an AppError carrying the raised word', async () => {
    rpc.mockResolvedValue({ data: null, error: pgError('invalid_invite') })
    const promise = callRpc('join_team_by_token', { p_token: 'x' })
    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({ code: 'invalid_invite' })
  })

  it('anything else becomes unknown and the Postgres text stays on cause', async () => {
    const raw = pgError('permission denied for function issue_reset_token')
    rpc.mockResolvedValue({ data: null, error: raw })
    await expect(
      callRpc('issue_reset_token', { p_user_id: 'u', p_team_id: 't' }),
    ).rejects.toMatchObject({
      code: 'unknown',
      message: 'unknown',
      cause: raw,
    })
  })

  it('an empty lookup is data, never an error', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(callRpc('lookup_team_invite', { p_token: 'x' })).resolves.toEqual([])
  })
})
