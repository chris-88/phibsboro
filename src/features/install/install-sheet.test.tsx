import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { InstallSheet, type InstallSheetVariant } from '@/features/install/install-sheet'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

type PromptInstall = (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null

function Harness({
  variant,
  promptInstall = null,
}: {
  variant: InstallSheetVariant
  promptInstall?: PromptInstall
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Open
      </button>
      <InstallSheet
        open={open}
        onOpenChange={setOpen}
        variant={variant}
        promptInstall={promptInstall}
      />
    </>
  )
}

describe('InstallSheet (S2.8)', () => {
  it('renders exactly the three written Android steps when no event is held (AC9)', async () => {
    const user = userEvent.setup()
    render(<Harness variant="android" />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog')
    const steps = within(dialog).getAllByRole('listitem')

    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveTextContent('Tap the three dots at the top right.')
    expect(steps[1]).toHaveTextContent('Tap Install app, or Add to Home screen.')
    expect(steps[2]).toHaveTextContent('Tap Install.')
  })

  it('returns focus to the control that opened it on close (AC13)', async () => {
    const user = userEvent.setup()
    render(<Harness variant="ios" />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await user.click(opener)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(opener).toHaveFocus()
  })

  it('shows the Install button on the installable variant and calls the event (AC5)', async () => {
    const user = userEvent.setup()
    const promptInstall = vi.fn().mockResolvedValue('accepted' as const)
    render(<Harness variant="installable" promptInstall={promptInstall} />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Install' }))
    expect(promptInstall).toHaveBeenCalledOnce()
  })
})
