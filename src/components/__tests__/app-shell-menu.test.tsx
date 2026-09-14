import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  signOut: vi.fn(),
  session: { value: { status: 'signedIn' } },
}))

vi.mock('@/features/auth/use-sign-out', () => ({
  useSignOut: () => ({ signOut: hoisted.signOut, isPending: false }),
}))
vi.mock('@/features/auth/session-context', () => ({
  useSession: () => hoisted.session.value,
}))

// S2.8's menu item hangs off the real install context; drive it from the test.
const installCtx: { value: { context: string; promptInstall: null } } = {
  value: { context: 'other', promptInstall: null },
}
vi.mock('@/features/install/install-context', () => ({
  useInstallContext: () => installCtx.value,
}))

const { AppShellMenu } = await import('@/components/app-shell-menu')
const { AppShell } = await import('@/components/app-shell')

beforeAll(() => {
  // Radix pointer/scroll handling is unimplemented in jsdom; stub it.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.signOut.mockReset()
  hoisted.session.value = { status: 'signedIn' }
  installCtx.value = { context: 'other', promptInstall: null }
})

describe('AppShellMenu (AC17)', () => {
  it('has a labelled trigger that clears the 44px floor', () => {
    render(<AppShellMenu />)
    const trigger = screen.getByRole('button', { name: 'Menu' })
    expect(trigger.className).toContain('size-tap')
  })

  it('Sign out calls useSignOut once', async () => {
    render(<AppShellMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    expect(hoisted.signOut).toHaveBeenCalledOnce()
  })

  it('disables Sign out while the session is loading', async () => {
    hoisted.session.value = { status: 'loading' }
    render(<AppShellMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('shows "Add to home screen" for a non-installed player and opens the sheet (S2.8 AC8)', async () => {
    installCtx.value = { context: 'ios-safari', promptInstall: null }
    render(<AppShellMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add to home screen' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('hides "Add to home screen" when installed (S2.8 AC2)', async () => {
    installCtx.value = { context: 'standalone', promptInstall: null }
    render(<AppShellMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await screen.findByRole('menuitem', { name: 'Sign out' })
    expect(screen.queryByRole('menuitem', { name: 'Add to home screen' })).not.toBeInTheDocument()
  })
})

describe('AppShell mounts the menu on nav chrome only (AC17)', () => {
  const renderShell = (chrome: 'nav' | 'bare') =>
    render(
      <MemoryRouter>
        <AppShell chrome={chrome} role="player" currentPath="/">
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    )

  it('shows the menu trigger on a nav route', () => {
    renderShell('nav')
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })

  it('shows no menu trigger on a bare route, which has a back affordance instead', () => {
    renderShell('bare')
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
