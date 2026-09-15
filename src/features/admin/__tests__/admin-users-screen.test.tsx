import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AdminUser } from '@/api/admin-users'

const hoisted = vi.hoisted(() => ({
  users: { value: undefined as unknown as UseQueryResult<AdminUser[]> },
  setMut: vi.fn(),
  removeMut: vi.fn(),
  isAdmin: { value: true },
  ready: { value: true },
}))

vi.mock('@/api/admin-users', () => ({
  useAllUsers: () => hoisted.users.value,
  useAdminSetMembership: () => ({ mutate: hoisted.setMut, isError: false }),
  useAdminRemoveMembership: () => ({ mutate: hoisted.removeMut, isError: false }),
}))
vi.mock('@/api/teams', () => ({
  useTeams: () => ({ data: [{ id: 't2', name: 'PCF II', active: true }] }),
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () =>
    hoisted.ready.value
      ? { status: 'ready', user: { isAdmin: hoisted.isAdmin.value } }
      : { status: 'loading' },
}))

const AdminUsersScreen = (await import('@/features/admin/AdminUsersScreen')).default

const query = (over: Partial<UseQueryResult<AdminUser[]>>): UseQueryResult<AdminUser[]> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...over,
  }) as unknown as UseQueryResult<AdminUser[]>

const user = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  name: 'Chris Quinn',
  phone: '+353876968718',
  memberships: [{ teamId: 't1', teamName: 'PCF I', role: 'player' }],
  ...over,
})

function renderScreen(
  q: UseQueryResult<AdminUser[]>,
  opts: { admin?: boolean; ready?: boolean } = {},
): void {
  hoisted.isAdmin.value = opts.admin ?? true
  hoisted.ready.value = opts.ready ?? true
  hoisted.users.value = q
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AdminUsersScreen />
    </MemoryRouter>,
  )
}

describe('AdminUsersScreen (S14.2)', () => {
  it('redirects a non-admin away', () => {
    renderScreen(query({ isSuccess: true, data: [] }), { admin: false })
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
  })

  it('shows the loading state', () => {
    renderScreen(query({ isPending: true }))
    expect(screen.getByLabelText('Loading users')).toBeInTheDocument()
  })

  it('shows an inline retry on error', async () => {
    const refetch = vi.fn()
    renderScreen(query({ isError: true, refetch }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows the empty state', () => {
    renderScreen(query({ isSuccess: true, data: [] }))
    expect(screen.getByText('No users yet.')).toBeInTheDocument()
  })

  it('lists a user with their name, phone and team membership', () => {
    renderScreen(query({ isSuccess: true, data: [user()] }))
    expect(screen.getByText('Chris Quinn')).toBeInTheDocument()
    expect(screen.getByText('+353876968718')).toBeInTheDocument()
    expect(screen.getByText('PCF I')).toBeInTheDocument()
  })

  it('filters by name', async () => {
    renderScreen(
      query({
        isSuccess: true,
        data: [user(), user({ id: 'u2', name: 'Aaron Byrne', memberships: [] })],
      }),
    )
    await userEvent.type(screen.getByLabelText('Search users'), 'aaron')
    expect(screen.getByText('Aaron Byrne')).toBeInTheDocument()
    expect(screen.queryByText('Chris Quinn')).not.toBeInTheDocument()
  })

  it('removes a membership only after a confirm (AC4)', async () => {
    renderScreen(query({ isSuccess: true, data: [user()] }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(hoisted.removeMut).not.toHaveBeenCalled() // first tap only asks to confirm
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(hoisted.removeMut).toHaveBeenCalledWith({ teamId: 't1', userId: 'u1' })
  })
})
