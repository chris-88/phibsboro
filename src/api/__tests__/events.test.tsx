import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'

const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const { useEventPreview, eventWriteErrorMessage } = await import('@/api/events')
const { eventKeys } = await import('@/api/queryKeys')
const { AppError } = await import('@/lib/errors')

const ID = '00000000-0000-4000-8000-000000000101'
const ROW = {
  team_id: '00000000-0000-4000-8000-000000000001',
  team_name: 'Firsts',
  type: 'training',
  title: 'Training',
  location: 'Fairview Park',
  starts_at: '2026-09-20T18:30:00+00:00',
  status: 'scheduled',
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useEventPreview — the worked hook (AC16)', () => {
  let client: QueryClient

  beforeEach(() => {
    rpc.mockReset()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('returns the parsed row under the preview key', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null })
    const { result } = renderHook(() => useEventPreview(ID), { wrapper: wrapperFor(client) })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(ROW)
    expect(rpc).toHaveBeenCalledWith('get_event_preview', { p_event_id: ID })
    expect(client.getQueryData(eventKeys.preview(ID))).toEqual(ROW)
  })

  it('an empty result is null — not found is a state, not an error', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { result } = renderHook(() => useEventPreview(ID), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  it('a raised word surfaces as an AppError on the query', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'not_authorised', code: 'P0001', details: '', hint: '' },
    })
    const { result } = renderHook(() => useEventPreview(ID), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(AppError)
    expect(result.current.error).toMatchObject({ code: 'not_authorised' })
  })

  it('a row that fails the schema is rejected rather than rendered', async () => {
    rpc.mockResolvedValue({ data: [{ ...ROW, status: 'postponed' }], error: null })
    const { result } = renderHook(() => useEventPreview(ID), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('does not fetch until it has an id', () => {
    const { result } = renderHook(() => useEventPreview(undefined), {
      wrapper: wrapperFor(client),
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('eventWriteErrorMessage — PostgREST refusal to copy (S4.1 AC9)', () => {
  // eventWriteErrorMessage reads only `.code`; a minimal stand-in keeps the test honest.
  const err = (code: string): PostgrestError =>
    ({ code, message: 'raw postgres text', details: '', hint: '' }) as unknown as PostgrestError

  it('maps a 42501 RLS refusal to the unmanaged/inactive team line', () => {
    expect(eventWriteErrorMessage(err('42501'))).toBe("You can't add events to that team.")
  })

  it('maps a 23514 check violation to the length line', () => {
    expect(eventWriteErrorMessage(err('23514'))).toBe(
      "That doesn't fit. Check the title and location lengths.",
    )
  })

  it('maps a 23503 FK violation to the missing-team line', () => {
    expect(eventWriteErrorMessage(err('23503'))).toBe('That team no longer exists.')
  })

  it('falls back to a generic retry line for anything else', () => {
    expect(eventWriteErrorMessage(err('XXXXX'))).toBe("Couldn't save. Try again.")
  })

  it('maps a PGRST116 (single() found no row) to the gone line (S4.2 AC12)', () => {
    expect(eventWriteErrorMessage(err('PGRST116'))).toBe('That event no longer exists.')
  })
})
