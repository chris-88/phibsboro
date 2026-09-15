import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RosterAttendance } from '@/lib/roster'

const USER = '00000000-0000-4000-8000-0000000000aa'
const EVENT = '00000000-0000-4000-8000-000000000101'
const P1 = '00000000-0000-4000-8000-000000000011'
const P2 = '00000000-0000-4000-8000-000000000012'

interface Result {
  data: unknown
  error: unknown
}
const results: Result[] = []
const nextResult = (): Result => results.shift() ?? { data: null, error: null }

/** Records every terminal call so a test can assert delete-vs-upsert and the payload sent. */
const calls: { op: string; payload?: unknown; opts?: unknown }[] = []

function makeBuilder(): Record<string, unknown> {
  const resolve = () => Promise.resolve(nextResult())
  const b: Record<string, unknown> = {}
  b.delete = () => {
    calls.push({ op: 'delete' })
    return b
  }
  b.upsert = (payload: unknown, opts: unknown) => {
    calls.push({ op: 'upsert', payload, opts })
    return b
  }
  b.select = () => b
  b.eq = (col: string, val: unknown) => {
    calls.push({ op: 'eq', payload: { col, val } })
    return b
  }
  b.lt = () => b
  b.order = () => b
  b.range = () => b
  b.then = (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
    resolve().then(onOk, onErr)
  return b
}

const from = vi.fn(() => makeBuilder())
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => from() } }))
vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({ status: 'signedIn', session: { user: { id: USER } } }),
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: () => ({ memberships: [] }),
}))

const { useSetAttendance, useBulkMarkAttended, useAttendanceHistory } =
  await import('@/api/attendance')
const { eventKeys } = await import('@/api/queryKeys')

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })
}

beforeEach(() => {
  results.length = 0
  calls.length = 0
  from.mockClear()
})

describe('useSetAttendance (S4.5)', () => {
  it('a null input issues a delete and never an upsert (AC3)', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useSetAttendance(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, attended: null })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    // Only write ops matter here; the delete path also records its .eq(...) filter now.
    expect(calls.filter((c) => c.op === 'delete' || c.op === 'upsert').map((c) => c.op)).toEqual([
      'delete',
    ])
  })

  it('an attended input upserts with recorded_by set to the acting user (AC2, AC4)', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useSetAttendance(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, attended: true })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(calls.find((c) => c.op === 'delete' || c.op === 'upsert')?.op).toBe('upsert')
    expect(calls[0]?.payload).toEqual({
      event_id: EVENT,
      user_id: P1,
      attended: true,
      recorded_by: USER,
    })
    expect(calls[0]?.opts).toEqual({ onConflict: 'event_id,user_id' })
  })

  it('a rejected mutation restores the previous cache value exactly (D48, AC9)', async () => {
    const client = freshClient()
    const before: RosterAttendance[] = [{ userId: P2, attended: false }]
    client.setQueryData(eventKeys.attendance(EVENT), before)
    results.push({ data: null, error: { code: '500', message: 'boom' } })

    const { result } = renderHook(() => useSetAttendance(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, attended: true })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // The optimistic add is rolled back to precisely the snapshot.
    expect(client.getQueryData(eventKeys.attendance(EVENT))).toEqual(before)
  })

  it('optimistically writes the new value before settling', async () => {
    const client = freshClient()
    client.setQueryData<RosterAttendance[]>(eventKeys.attendance(EVENT), [])
    // Hold the request open so the cache is observed mid-flight.
    let release: (() => void) | undefined
    results.push({ data: null, error: null })
    from.mockImplementationOnce(() => {
      const b = makeBuilder()
      b.then = (onOk: (r: Result) => unknown) =>
        new Promise<void>((res) => {
          release = res
        }).then(() => onOk(nextResult()))
      return b
    })
    const { result } = renderHook(() => useSetAttendance(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, attended: true })
    await waitFor(() => {
      expect(client.getQueryData(eventKeys.attendance(EVENT))).toEqual([
        { userId: P1, attended: true },
      ])
    })
    release?.()
  })
})

describe('useBulkMarkAttended (S4.5)', () => {
  it('returns the number of rows inserted from the select (AC6)', async () => {
    const client = freshClient()
    results.push({ data: [{ user_id: P1 }, { user_id: P2 }], error: null })
    const { result } = renderHook(() => useBulkMarkAttended(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate([P1, P2])
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe(2)
    expect(calls.find((c) => c.op === 'delete' || c.op === 'upsert')?.op).toBe('upsert')
    expect(calls[0]?.opts).toEqual({ onConflict: 'event_id,user_id', ignoreDuplicates: true })
  })

  it('writes nothing and returns 0 for an empty available list', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useBulkMarkAttended(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate([])
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('only fills blanks in the optimistic cache, leaving an existing row untouched (AC5)', async () => {
    const client = freshClient()
    client.setQueryData<RosterAttendance[]>(eventKeys.attendance(EVENT), [
      { userId: P1, attended: false },
    ])
    results.push({ data: [{ user_id: P2 }], error: null })
    const { result } = renderHook(() => useBulkMarkAttended(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate([P1, P2])
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    const cache = client.getQueryData<RosterAttendance[]>(eventKeys.attendance(EVENT))
    // P1's Absent survives; only P2 is added as attended.
    expect(cache).toContainEqual({ userId: P1, attended: false })
    expect(cache).toContainEqual({ userId: P2, attended: true })
  })
})

describe('useAttendanceHistory embed scoping (regression)', () => {
  it('filters the embedded attendance to the viewer, so an admin read does not widen past .max(1)', async () => {
    results.push({ data: [], error: null })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useAttendanceHistory(USER), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    // The read must scope the embedded attendance to this user, not rely on RLS — an admin's read
    // policy returns every squad member's row, which crashed the history without this filter.
    expect(calls).toContainEqual({ op: 'eq', payload: { col: 'attendance.user_id', val: USER } })
  })
})
