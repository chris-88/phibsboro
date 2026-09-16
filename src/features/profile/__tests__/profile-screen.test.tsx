import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/features/auth/use-current-user'

const hoisted = vi.hoisted(() => ({
  user: {
    value: {
      id: 'u1',
      name: 'Chris Quinn',
      phone: '+353876968718',
      avatarPath: null,
      memberships: [{ teamId: 't1', teamName: 'PCF II', role: 'manager', joinedAt: '2026-01-01' }],
    } as unknown as CurrentUser,
  },
  signOut: vi.fn(),
}))

vi.mock('@/features/auth/use-current-user', () => ({ useSignedInUser: () => hoisted.user.value }))
vi.mock('@/features/auth/use-sign-out', () => ({
  useSignOut: () => ({ signOut: hoisted.signOut, isPending: false }),
}))
vi.mock('@/features/install/use-install-menu-item', () => ({
  useInstallMenuItem: () => ({
    visible: false,
    isOpen: false,
    onOpenChange: vi.fn(),
    variant: 'ios',
    open: vi.fn(),
    promptInstall: null,
  }),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
}))

const ProfileScreen = (await import('@/features/profile/routes/ProfileScreen')).default

describe('ProfileScreen (S16.3)', () => {
  it('shows the name, phone, teams with role, and the moved actions', () => {
    render(<ProfileScreen />)
    expect(screen.getByRole('heading', { name: 'Chris Quinn' })).toBeInTheDocument()
    expect(screen.getByText('+353876968718')).toBeInTheDocument()
    expect(screen.getByText('PCF II')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('signs out on tap', async () => {
    render(<ProfileScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(hoisted.signOut).toHaveBeenCalledOnce()
  })

  it('shows the empty-teams line when on no teams', () => {
    hoisted.user.value = { ...hoisted.user.value, memberships: [] }
    render(<ProfileScreen />)
    expect(screen.getByText("You're on no teams yet.")).toBeInTheDocument()
  })
})
