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
  setAdminMut: vi.fn(),
  deleteMut: vi.fn(),
  isAdmin: { value: true },
  ready: { value: true },
}))

vi.mock('@/api/admin-users', () => ({
  useAllUsers: () => hoisted.users.value,
  useAdminSetMembership: () => ({ mutate: hoisted.setMut, isError: false }),
  useAdminRemoveMembership: () => ({ mutate: hoisted.removeMut, isError: false }),
  useAdminSetAdmin: () => ({ mutate: hoisted.setAdminMut, isPending: false, isError: false }),
  useAdminDeleteUser: () => ({ mutate: hoisted.deleteMut, isPending: false, isError: false }),
}))
vi.mock('@/api/teams', () => ({
  useTeams: () => ({ data: [{ id: 't2', name: 'PCF II', active: true }] }),
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () =>
    hoisted.ready.value
      ? { status: 'ready', user: { id: 'me', isAdmin: hoisted.isAdmin.value } }
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
  isAdmin: false,
  lastSignInAt: null,
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

  it('shows the last sign-in, or "Never signed in" (S18.5)', () => {
    renderScreen(
      query({
        isSuccess: true,
        data: [
          user({ id: 'u1', name: 'Seen User', lastSignInAt: '2026-09-14T14:24:00+00:00' }),
          user({ id: 'u2', name: 'New User', lastSignInAt: null, memberships: [] }),
        ],
      }),
    )
    expect(screen.getByText(/^Last seen /)).toBeInTheDocument()
    expect(screen.getByText('Never signed in')).toBeInTheDocument()
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

describe('AdminUsersScreen — admin & delete (S18.2)', () => {
  it('badges an admin and offers Remove admin; a non-admin offers Make admin', () => {
    renderScreen(query({ isSuccess: true, data: [user({ isAdmin: true })] }))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove admin' })).toBeInTheDocument()

    renderScreen(query({ isSuccess: true, data: [user({ isAdmin: false })] }))
    expect(screen.getByRole('button', { name: 'Make admin' })).toBeInTheDocument()
  })

  it('promotes and demotes through admin_set_admin', async () => {
    renderScreen(query({ isSuccess: true, data: [user({ id: 'u1', isAdmin: false })] }))
    await userEvent.click(screen.getByRole('button', { name: 'Make admin' }))
    expect(hoisted.setAdminMut).toHaveBeenCalledWith({ userId: 'u1', isAdmin: true })

    renderScreen(query({ isSuccess: true, data: [user({ id: 'u1', isAdmin: true })] }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove admin' }))
    expect(hoisted.setAdminMut).toHaveBeenLastCalledWith({ userId: 'u1', isAdmin: false })
  })

  it('hides the admin and delete actions on the viewer’s own row', () => {
    // The current user is 'me'; this row is 'me', so no self-admin toggle and no self-delete.
    renderScreen(query({ isSuccess: true, data: [user({ id: 'me', name: 'Me Myself' })] }))
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /make admin|remove admin/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete user/i })).not.toBeInTheDocument()
  })

  it('deletes a person only after typing their name to confirm', async () => {
    renderScreen(query({ isSuccess: true, data: [user({ id: 'u1', name: 'Chris Quinn' })] }))
    await userEvent.click(screen.getByRole('button', { name: /delete user/i }))
    // The confirm button is disabled until the typed name matches exactly.
    const del = screen.getByRole('button', { name: 'Delete' })
    expect(del).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type the name to confirm'), 'Chris Quinn')
    expect(del).toBeEnabled()
    await userEvent.click(del)
    // The mutate call carries the userId (plus per-call callbacks we don't assert on).
    expect(hoisted.deleteMut.mock.calls[0]?.[0]).toEqual({ userId: 'u1' })
  })
})
