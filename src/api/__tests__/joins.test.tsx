import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

const { callRpc } = vi.hoisted(() => ({ callRpc: vi.fn() }))
vi.mock('@/api/rpc', () => ({ callRpc }))

const { useJoinTeamByToken, useJoinTeamByEvent } = await import('@/api/joins')
const { userKeys, eventKeys } = await import('@/api/queryKeys')

const TEAM = { team_id: '00000000-0000-4000-8000-000000000001', team_name: 'Firsts' }

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })
}

describe('useJoinTeamByToken', () => {
  beforeEach(() => {
    callRpc.mockReset()
  })

  it('returns the joined team and invalidates the current user and events (AC3)', async () => {
    callRpc.mockResolvedValue([TEAM])
    const client = freshClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useJoinTeamByToken(), { wrapper: wrapperFor(client) })

    result.current.mutate('tok')
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(callRpc).toHaveBeenCalledWith('join_team_by_token', { p_token: 'tok' })
    expect(result.current.data).toEqual({ teamId: TEAM.team_id, teamName: TEAM.team_name })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: userKeys.current() })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: eventKeys.all })
  })

  it('raises invalid_invite when the RPC returns no row', async () => {
    callRpc.mockResolvedValue([])
    const { result } = renderHook(() => useJoinTeamByToken(), {
      wrapper: wrapperFor(freshClient()),
    })

    result.current.mutate('tok')
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(AppError)
    expect(result.current.error?.code).toBe('invalid_invite')
  })
})

describe('useJoinTeamByEvent', () => {
  beforeEach(() => {
    callRpc.mockReset()
  })

  it('joins by event id and returns the team (AC11)', async () => {
    callRpc.mockResolvedValue([TEAM])
    const { result } = renderHook(() => useJoinTeamByEvent(), {
      wrapper: wrapperFor(freshClient()),
    })

    result.current.mutate('ev1')
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(callRpc).toHaveBeenCalledWith('join_team_by_event', { p_event_id: 'ev1' })
    expect(result.current.data).toEqual({ teamId: TEAM.team_id, teamName: TEAM.team_name })
  })
})
