import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const { useEventPreview } = await import('@/api/events')
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
