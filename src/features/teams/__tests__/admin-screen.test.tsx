import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserState } from '@/features/auth/use-current-user'
import type { Team } from '@/features/teams/schema'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'

interface QueryState {
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  data: Team[] | undefined
  refetch: () => void
}

/** A ready account with the given admin flag. The screen reads only `.status` and
 *  `.user.isAdmin`; the rest satisfies the type. */
const ready = (isAdmin: boolean): CurrentUserState => ({
  status: 'ready',
  user: {
    id: 'u1',
    name: 'Admin',
    phone: '+353870000000',
    isAdmin,
    memberships: [],
    managedTeams: [],
    administrableTeams: [],
    isManagerOfAny: false,
    roleForTeam: () => null,
    isManagerOf: () => isAdmin,
  },
})

const hoisted = vi.hoisted(() => ({
  account: { value: null as unknown as CurrentUserState },
  teams: { value: null as unknown as QueryState },
  create: vi.fn(),
  rename: vi.fn(),
  setActive: vi.fn(),
  setColour: vi.fn(),
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.account.value,
}))
vi.mock('@/api/teams', () => ({
  useTeams: () => hoisted.teams.value,
  useCreateTeam: () => ({ mutate: hoisted.create, isPending: false }),
  useRenameTeam: () => ({ mutate: hoisted.rename, isPending: false }),
  useSetTeamActive: () => ({ mutate: hoisted.setActive, isPending: false }),
  useSetTeamColour: () => ({ mutate: hoisted.setColour, isPending: false }),
}))

const AdminScreen = (await import('@/features/teams/admin-screen')).default
const { useManageStore } = await import('@/features/teams/manageStore')

const team = (id: string, name: string, active: boolean): Team => ({
  id,
  name,
  active,
  colour: TEAM_COLOUR_DEFAULT,
  created_at: '2026-01-01T00:00:00+00:00',
})

const ACTIVE = team('00000000-0000-4000-8000-000000000001', 'Firsts', true)
const INACTIVE = team('00000000-0000-4000-8000-000000000002', 'Old Boys', false)

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="/manage" element={<div>manage screen</div>} />
        <Route path="/" element={<div>home screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeAll(() => {
  // Radix pointer handling and focus scroll are unimplemented in jsdom; stub them.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.account.value = ready(true)
  hoisted.create.mockReset()
  hoisted.rename.mockReset()
  hoisted.setActive.mockReset()
})

describe('admin gate (AC1)', () => {
  it('shows a loading placeholder while access resolves, no flash', () => {
    hoisted.account.value = { status: 'loading' }
    renderScreen()
    expect(screen.getByRole('status', { name: /checking access/i })).toBeInTheDocument()
    expect(screen.queryByText('home screen')).not.toBeInTheDocument()
  })

  it('redirects a non-admin home', () => {
    hoisted.account.value = ready(false)
    renderScreen()
    expect(screen.getByText('home screen')).toBeInTheDocument()
  })
})

describe('list states (AC10)', () => {
  it('loading: skeletons under a usable create form', () => {
    hoisted.teams.value = {
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      refetch: vi.fn(),
    }
    renderScreen()
    expect(screen.getByRole('status', { name: /loading teams/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Team name')).toBeInTheDocument()
  })

  it('empty: "No teams yet." with the create form', () => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [],
      refetch: vi.fn(),
    }
    renderScreen()
    expect(screen.getByText('No teams yet.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Team name')).toHaveFocus()
  })

  it('error: one line and a Retry that refetches; form stays usable', async () => {
    const refetch = vi.fn()
    hoisted.teams.value = {
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      refetch,
    }
    renderScreen()
    expect(screen.getByText("Couldn't load teams.")).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Team name')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('populated: Active then Inactive, the kept-not-deleted line, and no delete control (AC8, AC9)', () => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [ACTIVE, INACTIVE],
      refetch: vi.fn(),
    }
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inactive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Firsts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    expect(screen.getByText(/kept, never deleted/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it("each row links into that team's manage view, selecting it (S6.3 AC1)", async () => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [ACTIVE, INACTIVE],
      refetch: vi.fn(),
    }
    renderScreen()
    const rows = screen.getAllByRole('listitem')
    const firstsRow = rows.find((r) => within(r).queryByRole('button', { name: 'Firsts' }))
    if (firstsRow === undefined) throw new Error('Firsts row not found')
    await userEvent.click(within(firstsRow).getByRole('button', { name: 'Manage' }))
    expect(screen.getByText('manage screen')).toBeInTheDocument()
    expect(useManageStore.getState().selectedTeamId).toBe(ACTIVE.id)
  })
})

describe('create form (AC4)', () => {
  beforeEach(() => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [ACTIVE],
      refetch: vi.fn(),
    }
  })

  it('maps a duplicate to the field, not a toast', async () => {
    hoisted.create.mockImplementation((_vars: unknown, opts: { onError: (e: unknown) => void }) => {
      opts.onError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "teams_name_key"',
      })
    })
    renderScreen()
    await userEvent.type(screen.getByPlaceholderText('Team name'), 'firsts')
    await userEvent.click(screen.getByRole('button', { name: 'Add team' }))
    expect(hoisted.create).toHaveBeenCalledWith({ name: 'firsts' }, expect.anything())
    expect(await screen.findByText("There's already a team called that.")).toBeInTheDocument()
  })

  it('rejects a blank name inline before any request (AC3)', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Add team' }))
    expect(await screen.findByText('Give the team a name.')).toBeInTheDocument()
    expect(hoisted.create).not.toHaveBeenCalled()
  })
})

describe('rename (AC5)', () => {
  beforeEach(() => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [ACTIVE],
      refetch: vi.fn(),
    }
  })

  it('Escape restores the previous name and sends no mutation', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Firsts' }))
    const input = screen.getByRole('textbox', { name: /rename firsts/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Changed{Escape}')
    expect(hoisted.rename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Firsts' })).toBeInTheDocument()
  })

  it('Enter saves a changed name', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Firsts' }))
    const input = screen.getByRole('textbox', { name: /rename firsts/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Firsts A{Enter}')
    expect(hoisted.rename).toHaveBeenCalledWith(
      { id: ACTIVE.id, name: 'Firsts A' },
      expect.anything(),
    )
  })

  it('blur saves a changed name', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Firsts' }))
    const input = screen.getByRole('textbox', { name: /rename firsts/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Firsts B')
    await userEvent.tab()
    expect(hoisted.rename).toHaveBeenCalledWith(
      { id: ACTIVE.id, name: 'Firsts B' },
      expect.anything(),
    )
  })

  it('rejects an empty rename inline and sends no mutation (same rule as AC3)', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Firsts' }))
    const input = screen.getByRole('textbox', { name: /rename firsts/i })
    await userEvent.clear(input)
    await userEvent.type(input, '{Enter}')
    expect(await screen.findByText('Give the team a name.')).toBeInTheDocument()
    expect(hoisted.rename).not.toHaveBeenCalled()
  })
})

describe('deactivate (AC6)', () => {
  beforeEach(() => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [ACTIVE],
      refetch: vi.fn(),
    }
  })

  it('does nothing until the dialog is confirmed', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Deactivate Firsts\?/)).toBeInTheDocument()
    expect(hoisted.setActive).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(hoisted.setActive).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    const reopened = await screen.findByRole('alertdialog')
    await userEvent.click(within(reopened).getByRole('button', { name: 'Deactivate' }))
    expect(hoisted.setActive).toHaveBeenCalledWith(
      { id: ACTIVE.id, active: false },
      expect.anything(),
    )
  })

  it('reactivate toggles active back with no dialog', async () => {
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [INACTIVE],
      refetch: vi.fn(),
    }
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(hoisted.setActive).toHaveBeenCalledWith(
      { id: INACTIVE.id, active: true },
      expect.anything(),
    )
  })
})
