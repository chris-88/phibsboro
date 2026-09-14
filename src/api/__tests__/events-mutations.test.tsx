import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventFormValues } from '@/features/events/schema'

interface Result {
  data: unknown
  error: unknown
}

const results: Result[] = []
const nextResult = (): Result => results.shift() ?? { data: null, error: null }

/** The last payload passed to `.update()`, so a test can assert nothing but the six columns went. */
let lastUpdate: unknown = null

/** A minimal PostgREST builder: chain methods return the same thenable, terminals resolve. */
function makeBuilder(): Record<string, unknown> {
  const resolve = () => Promise.resolve(nextResult())
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.delete = chain
  b.eq = chain
  b.update = (payload: unknown) => {
    lastUpdate = payload
    return b
  }
  b.single = resolve
  b.then = (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
    resolve().then(onOk, onErr)
  return b
}

const from = vi.fn(() => makeBuilder())
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => from() } }))

const { useUpdateEvent, useSetEventStatus, useDeleteEvent } = await import('@/api/events')
const { eventKeys } = await import('@/api/queryKeys')

const ID = '00000000-0000-4000-8000-000000000101'
const TEAM = '00000000-0000-4000-8000-000000000001'
const ROW = {
  id: ID,
  team_id: TEAM,
  type: 'training',
  title: 'Training',
  location: 'Fairview Park',
  notes: null,
  opponent: null,
  home_away: null,
  starts_at: '2026-09-20T18:30:00+00:00',
  status: 'scheduled',
  series_id: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00+00:00',
  updated_at: '2026-01-01T00:00:00+00:00',
}

const VALUES: EventFormValues = {
  teamId: TEAM,
  type: 'match',
  title: 'Kilbarrack v Firsts',
  date: '2026-09-21',
  time: '19:30',
  location: 'Fairview Park pitch 3',
  notes: '',
  opponent: 'Kilbarrack',
  homeAway: 'away',
}

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
  lastUpdate = null
  from.mockClear()
})

describe('useUpdateEvent (S4.2)', () => {
  it('writes the editable columns plus a match opponent + home_away and invalidates eventKeys.all', async () => {
    const client = freshClient()
    results.push({ data: ROW, error: null })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateEvent(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID, values: VALUES })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    // team_id, created_by, created_at, series_id, status never in the payload (D30). A match now
    // also carries the derived title's raw fields opponent + home_away (S8.2).
    const payload = lastUpdate as Record<string, unknown>
    expect(payload).toMatchObject({
      type: 'match',
      title: 'Kilbarrack v Firsts',
      location: 'Fairview Park pitch 3',
      notes: null,
      opponent: 'Kilbarrack',
      home_away: 'away',
    })
    expect(Object.keys(payload).sort()).toEqual([
      'home_away',
      'location',
      'notes',
      'opponent',
      'starts_at',
      'title',
      'type',
    ])
    expect(payload.starts_at).toContain('2026-09-21')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: eventKeys.all })
  })

  it('surfaces a PGRST116 refusal (single() found no row) as the mutation error (AC12)', async () => {
    const client = freshClient()
    results.push({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    const { result } = renderHook(() => useUpdateEvent(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID, values: VALUES })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toMatchObject({ code: 'PGRST116' })
  })
})

describe('useSetEventStatus (S4.2)', () => {
  it('writes the status and nothing else, and invalidates eventKeys.all', async () => {
    const client = freshClient()
    results.push({ data: { ...ROW, status: 'cancelled' }, error: null })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSetEventStatus(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID, status: 'cancelled' })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(lastUpdate).toEqual({ status: 'cancelled' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: eventKeys.all })
  })
})

describe('useDeleteEvent (S4.2)', () => {
  it('resolves with the deleted id when a row comes back', async () => {
    const client = freshClient()
    results.push({ data: [{ id: ID }], error: null })
    const { result } = renderHook(() => useDeleteEvent(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({ id: ID })
  })

  it('rejects on an empty array — RLS refused, or already gone (AC9)', async () => {
    const client = freshClient()
    results.push({ data: [], error: null })
    const { result } = renderHook(() => useDeleteEvent(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
