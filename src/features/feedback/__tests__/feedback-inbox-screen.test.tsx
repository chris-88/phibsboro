import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { FeedbackInbox } from '@/api/feedback'
import type { FeedbackInboxRow } from '@/features/feedback/schema'

const hoisted = vi.hoisted(() => ({
  inbox: { value: undefined as unknown as FeedbackInbox },
  resolveMut: vi.fn(),
  isAdmin: { value: true },
  ready: { value: true },
}))

vi.mock('@/api/feedback', () => ({
  useFeedbackInbox: () => hoisted.inbox.value,
  useResolveFeedback: () => ({
    mutate: hoisted.resolveMut,
    isPending: false,
    variables: undefined,
  }),
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () =>
    hoisted.ready.value
      ? { status: 'ready', user: { isAdmin: hoisted.isAdmin.value } }
      : { status: 'loading' },
}))

const FeedbackInboxScreen = (await import('@/features/feedback/routes/FeedbackInboxScreen')).default

const base: FeedbackInbox = {
  rows: [],
  status: 'success',
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}

const row = (over: Partial<FeedbackInboxRow> = {}): FeedbackInboxRow => ({
  id: '00000000-0000-4000-8000-000000000101',
  user_id: '00000000-0000-4000-8000-0000000000aa',
  category: 'bug',
  message: 'the share button lost the link',
  context: { route: '/manage/event/1', release: 'abc1234' },
  status: 'open',
  created_at: '2026-09-15T10:00:00.000Z',
  resolved_at: null,
  resolved_by: null,
  reporter: { name: 'Chris Quinn' },
  ...over,
})

function renderInbox(inbox: FeedbackInbox, opts: { admin?: boolean; ready?: boolean } = {}): void {
  hoisted.isAdmin.value = opts.admin ?? true
  hoisted.ready.value = opts.ready ?? true
  hoisted.inbox.value = inbox
  render(
    <MemoryRouter initialEntries={['/admin/feedback']}>
      <FeedbackInboxScreen />
    </MemoryRouter>,
  )
}

describe('FeedbackInboxScreen (S12.3)', () => {
  it('redirects a non-admin away (RLS is the boundary; this is convenience)', () => {
    renderInbox(base, { admin: false })
    expect(screen.queryByText('Feedback')).not.toBeInTheDocument()
    expect(screen.queryByText('No feedback yet.')).not.toBeInTheDocument()
  })

  it('shows the loading skeleton while pending', () => {
    renderInbox({ ...base, status: 'pending' })
    expect(screen.getByLabelText('Loading feedback')).toBeInTheDocument()
  })

  it('shows an inline retry on error', async () => {
    const refetch = vi.fn()
    renderInbox({ ...base, status: 'error', refetch })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows the empty state when there is no feedback', () => {
    renderInbox({ ...base, rows: [] })
    expect(screen.getByText('No feedback yet.')).toBeInTheDocument()
  })

  it('lists a report with reporter, category, message and context', () => {
    renderInbox({ ...base, rows: [row()] })
    expect(screen.getByText('Chris Quinn')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('the share button lost the link')).toBeInTheDocument()
    expect(screen.getByText('/manage/event/1')).toBeInTheDocument()
  })

  it('resolves an open report on tap', async () => {
    renderInbox({ ...base, rows: [row()] })
    await userEvent.click(screen.getByRole('button', { name: 'Mark resolved' }))
    expect(hoisted.resolveMut).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000101')
  })

  it('shows a resolved report without the resolve action', () => {
    renderInbox({ ...base, rows: [row({ status: 'resolved' })] })
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument()
  })
})
