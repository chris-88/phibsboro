import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'

interface Result {
  data: unknown
  error: unknown
}

const results: Result[] = []
const nextResult = (): Result => results.shift() ?? { data: null, error: null }

/** A minimal PostgREST builder: chain methods return the same thenable, terminals resolve. */
function makeBuilder(): Record<string, unknown> {
  const resolve = () => Promise.resolve(nextResult())
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.insert = chain
  b.update = chain
  b.eq = chain
  b.single = resolve
  b.then = (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
    resolve().then(onOk, onErr)
  return b
}

const from = vi.fn(() => makeBuilder())
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => from() } }))

const { useCreateTeam, useRenameTeam } = await import('@/api/teams')
const { teamKeys } = await import('@/api/queryKeys')

const ID = '00000000-0000-4000-8000-000000000001'
const ROW = {
  id: ID,
  name: 'Firsts',
  active: true,
  colour: TEAM_COLOUR_DEFAULT,
  created_at: '2026-01-01T00:00:00+00:00',
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useCreateTeam', () => {
  let client: QueryClient

  beforeEach(() => {
    results.length = 0
    from.mockClear()
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    })
  })

  it('returns the created row and invalidates teamKeys.all', async () => {
    results.push({ data: ROW, error: null })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateTeam(), { wrapper: wrapperFor(client) })

    result.current.mutate({ name: 'Firsts' })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(ROW)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: teamKeys.all })
  })

  it('surfaces a duplicate-name PostgrestError raw, not an AppError', async () => {
    results.push({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "teams_name_key"',
      },
    })
    const { result } = renderHook(() => useCreateTeam(), { wrapper: wrapperFor(client) })

    result.current.mutate({ name: 'firsts' })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toMatchObject({ code: '23505' })
  })
})

describe('useRenameTeam optimistic rollback (AC12)', () => {
  let client: QueryClient

  beforeEach(() => {
    results.length = 0
    from.mockClear()
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    })
    client.setQueryData(teamKeys.all, [ROW])
  })

  it('shows the new name mid-flight, then restores the snapshot on error', async () => {
    results.push({ data: null, error: { code: '500', message: 'network' } })
    const { result } = renderHook(() => useRenameTeam(), { wrapper: wrapperFor(client) })

    result.current.mutate({ id: ID, name: 'Renamed' })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // Rolled back to the snapshot, so the failed rename left no trace in the cache.
    expect(client.getQueryData(teamKeys.all)).toEqual([ROW])
  })
})
