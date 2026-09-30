import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberDirectoryRow } from '@/features/teams/schema'

const hoisted = vi.hoisted(() => ({
  remove: { fn: vi.fn(), isPending: false },
  setRole: { fn: vi.fn(), isPending: false },
  setPhone: { fn: vi.fn(), isPending: false },
  setName: { fn: vi.fn(), isPending: false },
}))

vi.mock('@/api/members', () => ({
  useRemoveMember: () => ({ mutate: hoisted.remove.fn, isPending: hoisted.remove.isPending }),
  useSetMemberRole: () => ({ mutate: hoisted.setRole.fn, isPending: hoisted.setRole.isPending }),
  useSetMemberPhone: () => ({ mutate: hoisted.setPhone.fn, isPending: hoisted.setPhone.isPending }),
  useSetMemberName: () => ({ mutate: hoisted.setName.fn, isPending: hoisted.setName.isPending }),
}))

const { MemberCard } = await import('@/features/teams/member-card')

const TEAM = '00000000-0000-4000-8000-000000000001'

const member = (over: Partial<MemberDirectoryRow> = {}): MemberDirectoryRow => ({
  user_id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Aaron Byrne',
  role: 'player',
  joined_at: '2026-01-10T00:00:00Z',
  phone: '+353871234567',
  ...over,
})

function renderCard(
  props: { isAdmin?: boolean; managerCount?: number; member?: Partial<MemberDirectoryRow> } = {},
) {
  return render(
    <MemberCard
      teamId={TEAM}
      teamName="Firsts"
      member={member(props.member)}
      isAdmin={props.isAdmin ?? false}
      managerCount={props.managerCount ?? 2}
    />,
  )
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.remove.fn.mockReset()
  hoisted.setRole.fn.mockReset()
  hoisted.setPhone.fn.mockReset()
  hoisted.setName.fn.mockReset()
  hoisted.remove.isPending = false
})

describe('name, phone and join date (AC1)', () => {
  it('renders the name, role badge, phone and join date through formatEventTime', () => {
    renderCard()
    expect(screen.getByText('Aaron Byrne')).toBeInTheDocument()
    expect(screen.getByText('Player')).toBeInTheDocument()
    expect(screen.getByText(/\+353871234567 · Joined Sat 10 Jan/)).toBeInTheDocument()
  })

  it('renders a dash rather than null when the phone is withheld (D8)', () => {
    renderCard({ member: { phone: null } })
    expect(screen.getByText(/^— · Joined/)).toBeInTheDocument()
  })
})

describe('actions by caller role (AC4, AC5; S20.2)', () => {
  it('a manager sees Correct name and Remove on a player card, not Change role or Correct phone', async () => {
    renderCard({ isAdmin: false, member: { role: 'player' } })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    expect(await screen.findByRole('menuitem', { name: 'Correct name' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Change role' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Correct phone' })).not.toBeInTheDocument()
  })

  it('a manager sees Correct name (only) on a manager card — no Remove, role or phone (S20.2)', async () => {
    renderCard({ isAdmin: false, member: { role: 'manager' } })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    expect(await screen.findByRole('menuitem', { name: 'Correct name' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Change role' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Correct phone' })).not.toBeInTheDocument()
  })

  it('an admin sees Change role, Correct name, Correct phone and Remove on every card', async () => {
    renderCard({ isAdmin: true, member: { role: 'manager' }, managerCount: 2 })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    expect(await screen.findByRole('menuitem', { name: 'Change role' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Correct name' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Correct phone' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument()
  })
})

describe('correct name (S20.2)', () => {
  it('opens the dialog and saves the trimmed name', async () => {
    renderCard({ isAdmin: false, member: { role: 'player', name: 'aron' } })
    await userEvent.click(screen.getByRole('button', { name: /Actions for aron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Correct name' }))
    const field = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.clear(field)
    await userEvent.type(field, '  Aaron Byrne  ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(hoisted.setName.fn).toHaveBeenCalledOnce()
    expect(hoisted.setName.fn.mock.calls[0]?.[0]).toMatchObject({ name: 'Aaron Byrne' })
  })

  it('rejects an empty name inline and sends nothing', async () => {
    renderCard({ isAdmin: false, member: { role: 'player' } })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Correct name' }))
    const field = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.clear(field)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Give them a name.')).toBeInTheDocument()
    expect(hoisted.setName.fn).not.toHaveBeenCalled()
  })
})

describe('remove confirmation (AC3, AC7)', () => {
  it('fires no mutation until the confirmation is accepted', async () => {
    renderCard({ isAdmin: true })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    expect(
      await screen.findByText('Their past availability and attendance are kept.'),
    ).toBeVisible()
    expect(hoisted.remove.fn).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(hoisted.remove.fn).toHaveBeenCalledOnce()
  })

  it('adds the last-manager line only when exactly one manager remains (AC7)', async () => {
    renderCard({ isAdmin: true, member: { role: 'manager' }, managerCount: 1 })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    expect(await screen.findByText(/This leaves Firsts with no manager\./)).toBeInTheDocument()
  })

  it('omits the last-manager line when another manager remains', async () => {
    renderCard({ isAdmin: true, member: { role: 'manager' }, managerCount: 2 })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    expect(
      await screen.findByText('Their past availability and attendance are kept.'),
    ).toBeVisible()
    expect(screen.queryByText(/no manager/)).not.toBeInTheDocument()
  })
})

describe('change role dialog (AC5)', () => {
  it('offers exactly two options and never admin', async () => {
    renderCard({ isAdmin: true })
    await userEvent.click(screen.getByRole('button', { name: /Actions for Aaron/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Change role' }))
    await userEvent.click(await screen.findByRole('combobox', { name: 'Role' }))
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options.map((o) => o.textContent)).toEqual(['Player', 'Manager'])
    expect(screen.queryByRole('option', { name: /admin/i })).not.toBeInTheDocument()
  })
})
