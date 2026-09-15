import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import type { EventDetail } from '@/api/events'
import { SessionContext, type SessionState } from '@/features/auth/session-context'

// The one write the buttons make, controllable per test.
const upsert = vi.fn<(...args: unknown[]) => Promise<{ error: unknown }>>()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }) },
}))

const { AvailabilityButtons } =
  await import('@/features/availability/components/AvailabilityButtons')
const { eventKeys } = await import('@/api/queryKeys')

const EVENT_ID = '00000000-0000-4000-8000-000000000102'
const USER_ID = '00000000-0000-4000-8000-0000000000aa'

const signedIn: SessionState = {
  status: 'signedIn',
  session: { user: { id: USER_ID } } as Session,
}

const detailWith = (myResponse: EventDetail['myResponse']): EventDetail => ({
  id: EVENT_ID,
  teamId: '00000000-0000-4000-8000-000000000001',
  teamName: 'Firsts',
  type: 'training',
  title: 'Training',
  location: 'Dalymount Park',
  notes: null,
  opponent: null,
  homeAway: null,
  jersey: null,
  meetAt: null,
  startsAt: '2026-09-15T00:07:26.597+00:00',
  status: 'scheduled',
  myResponse,
})

/** Reads the detail cache and feeds `current` to the buttons, exactly as the screen does, so the
 *  optimistic write and its rollback are observable through the rendered button state. */
function Harness(): React.JSX.Element {
  const q = useQuery<EventDetail>({
    queryKey: eventKeys.detail(EVENT_ID),
    queryFn: () => Promise.reject(new Error('must not fetch')),
    enabled: false,
  })
  return q.data ? <AvailabilityButtons eventId={EVENT_ID} current={q.data.myResponse} /> : <div />
}

function renderWith(initial: EventDetail): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(eventKeys.detail(EVENT_ID), initial)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={signedIn}>{children}</SessionContext.Provider>
    </QueryClientProvider>
  )
  render(<Harness />, { wrapper })
  return client
}

const yes = () => screen.getByRole('button', { name: 'Yes' })
const no = () => screen.getByRole('button', { name: 'No' })

beforeEach(() => {
  upsert.mockReset()
})

describe('AvailabilityButtons (S3.3)', () => {
  it('marks the current answer with aria-pressed and a confirming line (AC6)', () => {
    renderWith(detailWith('available'))
    expect(yes()).toHaveAttribute('aria-pressed', 'true')
    expect(no()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('You said yes.')).toBeInTheDocument()
  })

  it('tapping the answer already selected fires no request (AC7, D61)', async () => {
    renderWith(detailWith('available'))
    await userEvent.click(yes())
    expect(upsert).not.toHaveBeenCalled()
  })

  it('tapping the other answer writes it and reflects it before the request resolves (AC5)', async () => {
    let resolve: (v: { error: unknown }) => void = () => undefined
    upsert.mockReturnValue(
      new Promise<{ error: unknown }>((r) => {
        resolve = r
      }),
    )
    renderWith(detailWith('available'))
    await userEvent.click(no())
    // Optimistic: No is pressed while the request is still in flight.
    await waitFor(() => {
      expect(no()).toHaveAttribute('aria-pressed', 'true')
    })
    expect(yes()).toHaveAttribute('aria-pressed', 'false')
    expect(upsert).toHaveBeenCalledWith(
      { event_id: EVENT_ID, user_id: USER_ID, response: 'unavailable' },
      { onConflict: 'event_id,user_id' },
    )
    resolve({ error: null })
  })

  it('restores the previous answer and shows the failure line when the write fails (AC8)', async () => {
    upsert.mockResolvedValue({
      error: { message: 'nope', details: '', hint: '', code: 'P0001', name: 'PostgrestError' },
    })
    renderWith(detailWith('available'))
    await userEvent.click(no())
    await waitFor(() => {
      expect(screen.getByText("Couldn't save. Tap again.")).toBeInTheDocument()
    })
    // Rolled back to the previous answer, both buttons still enabled.
    expect(yes()).toHaveAttribute('aria-pressed', 'true')
    expect(no()).toHaveAttribute('aria-pressed', 'false')
    expect(yes()).toBeEnabled()
    expect(no()).toBeEnabled()
  })

  it('a 42501 window-shut refusal rolls back and shows no retry line (S3.4 AC9)', async () => {
    upsert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy',
        details: '',
        hint: '',
        code: '42501',
        name: 'PostgrestError',
      },
    })
    renderWith(detailWith('available'))
    await userEvent.click(no())
    // Rolled back to the previous answer, and — unlike a network failure — no line is shown.
    await waitFor(() => {
      expect(yes()).toHaveAttribute('aria-pressed', 'true')
    })
    expect(no()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText("Couldn't save. Tap again.")).not.toBeInTheDocument()
  })

  it('disables both buttons and shows the reason for a cancelled event (AC14)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={signedIn}>{children}</SessionContext.Provider>
      </QueryClientProvider>
    )
    render(
      <AvailabilityButtons
        eventId={EVENT_ID}
        current="available"
        disabled
        disabledReason="This one's off."
      />,
      { wrapper },
    )
    expect(yes()).toBeDisabled()
    expect(no()).toBeDisabled()
    expect(screen.getByText("This one's off.")).toBeInTheDocument()
    // The existing answer is still shown (AC14).
    expect(screen.getByText('You said yes.')).toBeInTheDocument()
    await userEvent.click(yes())
    expect(upsert).not.toHaveBeenCalled()
  })
})
