import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventResponseRow } from '@/features/availability/schema'

const EVENT = '00000000-0000-4000-8000-000000000101'
const P1 = '00000000-0000-4000-8000-000000000011'
const OTHER = '00000000-0000-4000-8000-000000000012'

const rpcResult = { value: { data: null as unknown, error: null as unknown } }
const rpcCalls: { fn: string; args: unknown }[] = []
const rpc = vi.fn(() => Promise.resolve(rpcResult.value))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return rpc()
    },
  },
}))

const { useSetResponseFor } = await import('@/api/availability')
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
const responseRow = (userId: string, response: 'available' | 'unavailable'): EventResponseRow => ({
  event_id: EVENT,
  user_id: userId,
  response,
  updated_at: 'x',
})

beforeEach(() => {
  rpcCalls.length = 0
  rpcResult.value = { data: null, error: null }
  rpc.mockClear()
  rpc.mockImplementation(() => Promise.resolve(rpcResult.value))
})

describe('useSetResponseFor (S18.1)', () => {
  it('calls set_response_for with the event, the subject and the response', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useSetResponseFor(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, response: 'available' })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(rpcCalls[0]).toEqual({
      fn: 'set_response_for',
      args: { p_event_id: EVENT, p_user_id: P1, p_response: 'available' },
    })
  })

  it('optimistically upserts the subject into the responses cache before settling', async () => {
    const client = freshClient()
    client.setQueryData<EventResponseRow[]>(eventKeys.responses(EVENT), [
      responseRow(OTHER, 'available'),
    ])
    let release: (() => void) | undefined
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(rpcResult.value)
          }
        }),
    )
    const { result } = renderHook(() => useSetResponseFor(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, response: 'unavailable' })
    await waitFor(() => {
      const rows = client.getQueryData<EventResponseRow[]>(eventKeys.responses(EVENT)) ?? []
      expect(rows.find((r) => r.user_id === P1)?.response).toBe('unavailable')
    })
    // The teammate's row is untouched.
    const rows = client.getQueryData<EventResponseRow[]>(eventKeys.responses(EVENT)) ?? []
    expect(rows.find((r) => r.user_id === OTHER)?.response).toBe('available')
    release?.()
  })

  it('rolls the cache back to the snapshot on a refusal, surfacing the code', async () => {
    const client = freshClient()
    const before: EventResponseRow[] = [responseRow(OTHER, 'available')]
    client.setQueryData(eventKeys.responses(EVENT), before)
    rpcResult.value = { data: null, error: { code: 'P0001', message: 'not_authorised' } }

    const { result } = renderHook(() => useSetResponseFor(EVENT), { wrapper: wrapperFor(client) })
    result.current.mutate({ userId: P1, response: 'available' })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(client.getQueryData(eventKeys.responses(EVENT))).toEqual(before)
    expect(result.current.error?.code).toBe('not_authorised')
  })
})
