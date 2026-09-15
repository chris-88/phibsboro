import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER = '00000000-0000-4000-8000-0000000000aa'

interface Result {
  data: unknown
  error: unknown
}
const results: Result[] = []
const nextResult = (): Result => results.shift() ?? { data: null, error: null }
const calls: { op: string; payload?: unknown }[] = []

function makeBuilder(): Record<string, unknown> {
  const resolve = () => Promise.resolve(nextResult())
  const b: Record<string, unknown> = {}
  b.insert = (payload: unknown) => {
    calls.push({ op: 'insert', payload })
    return b
  }
  b.select = () => b
  b.order = () => b
  b.range = () => b
  b.then = (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
    resolve().then(onOk, onErr)
  return b
}

const from = vi.fn(() => makeBuilder())
const rpc = vi.fn((name: string, args: unknown) => {
  calls.push({ op: 'rpc', payload: { name, args } })
  return Promise.resolve(nextResult())
})
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => from(), rpc: (n: string, a: unknown) => rpc(n, a) },
}))
vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({ status: 'signedIn', session: { user: { id: USER } } }),
}))

const { useSubmitFeedback, useResolveFeedback, useFeedbackInbox } = await import('@/api/feedback')

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } })
}

beforeEach(() => {
  results.length = 0
  calls.length = 0
  from.mockClear()
  rpc.mockClear()
})

describe('useSubmitFeedback (S12.2)', () => {
  it('inserts with user_id from the session, never a field (W2)', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useSubmitFeedback(), { wrapper: wrapperFor(client) })
    result.current.mutate({
      input: { category: 'bug', message: '  it broke  ' },
      context: { route: '/x', release: 'abc' },
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    const insert = calls.find((c) => c.op === 'insert')
    expect(insert?.payload).toEqual({
      user_id: USER,
      category: 'bug',
      message: 'it broke', // trimmed
      context: { route: '/x', release: 'abc' },
    })
  })
})

describe('useResolveFeedback (S12.3)', () => {
  it('calls the resolve_feedback RPC with the row id', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useResolveFeedback(), { wrapper: wrapperFor(client) })
    result.current.mutate('feedback-1')
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(calls).toContainEqual({
      op: 'rpc',
      payload: { name: 'resolve_feedback', args: { p_id: 'feedback-1' } },
    })
  })
})

describe('useFeedbackInbox (S12.3)', () => {
  it('reads and parses inbox rows with the embedded reporter name', async () => {
    results.push({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000101',
          user_id: USER,
          category: 'idea',
          message: 'add dark mode',
          context: { route: '/' },
          status: 'open',
          created_at: '2026-09-15T10:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
          reporter: { name: 'Chris Quinn' },
        },
      ],
      error: null,
    })
    const client = freshClient()
    const { result } = renderHook(() => useFeedbackInbox(), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    expect(result.current.rows[0]?.reporter?.name).toBe('Chris Quinn')
    expect(result.current.rows[0]?.category).toBe('idea')
  })
})
