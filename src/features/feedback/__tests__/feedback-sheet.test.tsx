import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: { value: false },
  isError: { value: false },
}))

vi.mock('@/api/feedback', () => ({
  useSubmitFeedback: () => ({
    mutate: hoisted.mutate,
    isPending: hoisted.isPending.value,
    isError: hoisted.isError.value,
  }),
}))
vi.mock('@/lib/version', () => ({ getAppVersion: () => 'abc1234' }))
vi.mock('@/lib/standalone', () => ({ isStandalone: () => false }))

const { FeedbackSheet } = await import('@/features/feedback/FeedbackSheet')

function renderSheet(): { onOpenChange: ReturnType<typeof vi.fn> } {
  const onOpenChange = vi.fn()
  render(
    <MemoryRouter initialEntries={['/event/abc']}>
      <FeedbackSheet open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  )
  return { onOpenChange }
}

beforeEach(() => {
  hoisted.mutate.mockReset()
  hoisted.isPending.value = false
  hoisted.isError.value = false
})

describe('FeedbackSheet (S12.2)', () => {
  it('renders the category choices and the message field when open', () => {
    renderSheet()
    expect(screen.getByRole('radio', { name: 'Bug' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Idea' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your feedback')).toBeInTheDocument()
  })

  it('blocks submit with an empty message and does not call the mutation', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(hoisted.mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Please type your feedback')).toBeInTheDocument()
  })

  it('submits the chosen category, message and the captured route/release context', async () => {
    // Succeed by invoking the onSuccess the component passes.
    hoisted.mutate.mockImplementation((_payload, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    )
    renderSheet()
    await userEvent.click(screen.getByRole('radio', { name: 'Idea' }))
    await userEvent.type(screen.getByLabelText('Your feedback'), 'add a dark mode')
    await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(hoisted.mutate).toHaveBeenCalledTimes(1)
    const payload = hoisted.mutate.mock.calls[0]?.[0] as {
      input: { category: string; message: string }
      context: { route: string; release: string }
    }
    expect(payload.input).toEqual({ category: 'idea', message: 'add a dark mode' })
    expect(payload.context.route).toBe('/event/abc')
    expect(payload.context.release).toBe('abc1234')
    // The thank-you state replaces the form.
    expect(screen.getByText('Thanks!')).toBeInTheDocument()
  })

  it('keeps the form and shows an inline error when the send fails', () => {
    hoisted.isError.value = true
    renderSheet()
    expect(screen.getByText(/Couldn't send that/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeInTheDocument()
  })
})
