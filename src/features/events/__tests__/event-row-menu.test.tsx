import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser, CurrentUserState } from '@/features/auth/use-current-user'
import type { EventRow } from '@/features/events/schema'

// The three dialogs own mutation hooks that reach the query cache; stub them so this test is only
// about which menu items show. Their own behaviour is covered by the mutation and schema tests.
vi.mock('@/features/events/components/EventFormDialog', () => ({ EventFormDialog: () => null }))
vi.mock('@/features/events/components/CancelEventDialog', () => ({ CancelEventDialog: () => null }))
vi.mock('@/features/events/components/DeleteEventDialog', () => ({ DeleteEventDialog: () => null }))

const hoisted = vi.hoisted(() => ({
  isAdmin: { value: false },
  now: { value: 0 },
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: (): CurrentUserState => ({
    status: 'ready',
    user: { isAdmin: hoisted.isAdmin.value } as CurrentUser,
  }),
}))
vi.mock('@/lib/serverClock', () => ({ serverNow: () => new Date(hoisted.now.value) }))

const { EventRowMenu } = await import('@/features/events/components/EventRowMenu')

// A fixed "now" for the deterministic past/future cases (AC8). No wall clock.
const NOW = new Date('2026-03-14T12:00:00Z').getTime()
const FUTURE = '2026-03-14T18:00:00+00:00'
const PAST = '2026-03-14T06:00:00+00:00'

function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    team_id: '00000000-0000-4000-8000-000000000001',
    type: 'training',
    title: 'Training',
    location: 'Fairview Park',
    notes: null,
    starts_at: FUTURE,
    status: 'scheduled',
    series_id: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    ...overrides,
  }
}

async function openMenu(event: EventRow): Promise<void> {
  render(<EventRowMenu event={event} teamName="Firsts" />)
  await userEvent.click(screen.getByRole('button', { name: /actions for/i }))
}

const item = (name: RegExp): HTMLElement | null => screen.queryByRole('menuitem', { name })

beforeEach(() => {
  hoisted.isAdmin.value = false
  hoisted.now.value = NOW
})

describe('EventRowMenu — item visibility (S4.2 AC1, AC8)', () => {
  it('scheduled + future + manager: Edit and Cancel, no Reinstate, no Delete', async () => {
    await openMenu(eventRow({ status: 'scheduled', starts_at: FUTURE }))
    expect(item(/edit/i)).toBeInTheDocument()
    expect(item(/cancel/i)).toBeInTheDocument()
    expect(item(/reinstate/i)).not.toBeInTheDocument()
    expect(item(/delete/i)).not.toBeInTheDocument()
  })

  it('scheduled + past + manager: Cancel still shows (status, not time, gates it)', async () => {
    await openMenu(eventRow({ status: 'scheduled', starts_at: PAST }))
    expect(item(/cancel/i)).toBeInTheDocument()
    expect(item(/reinstate/i)).not.toBeInTheDocument()
  })

  it('cancelled + future + manager: Edit and Reinstate, no Cancel', async () => {
    await openMenu(eventRow({ status: 'cancelled', starts_at: FUTURE }))
    expect(item(/edit/i)).toBeInTheDocument()
    expect(item(/reinstate/i)).toBeInTheDocument()
    expect(item(/cancel/i)).not.toBeInTheDocument()
  })

  it('cancelled + past + manager: no Reinstate — a started event cannot be reinstated (AC8)', async () => {
    await openMenu(eventRow({ status: 'cancelled', starts_at: PAST }))
    expect(item(/edit/i)).toBeInTheDocument()
    expect(item(/reinstate/i)).not.toBeInTheDocument()
    expect(item(/cancel/i)).not.toBeInTheDocument()
  })

  it('a device clock an hour behind does not reveal Reinstate on a started event (AC8, D48)', async () => {
    // serverNow is the true now; a slow device clock cannot change it, so a cancelled event that
    // started six hours ago still offers no Reinstate.
    hoisted.now.value = NOW
    await openMenu(eventRow({ status: 'cancelled', starts_at: PAST }))
    expect(item(/reinstate/i)).not.toBeInTheDocument()
  })

  it('Delete is absent for a non-admin (AC9)', async () => {
    hoisted.isAdmin.value = false
    await openMenu(eventRow())
    expect(item(/delete/i)).not.toBeInTheDocument()
  })

  it('Delete shows for an admin (AC1)', async () => {
    hoisted.isAdmin.value = true
    await openMenu(eventRow())
    expect(item(/delete/i)).toBeInTheDocument()
  })
})
