import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }),
    },
  },
}))

const { Avatar } = await import('@/features/profile/Avatar')
const { initialsOf } = await import('@/features/profile/avatar-url')

describe('initialsOf', () => {
  it('takes first+last initials, or two of a single name, or ? for blank', () => {
    expect(initialsOf('Chris Quinn')).toBe('CQ')
    expect(initialsOf('  aaron   byrne ')).toBe('AB')
    expect(initialsOf('Cher')).toBe('CH')
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('Avatar (S16.2)', () => {
  it('renders initials when there is no photo', () => {
    render(<Avatar path={null} name="Chris Quinn" />)
    expect(screen.getByText('CQ')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the photo when a path is set', () => {
    const { container } = render(<Avatar path="uid/1.jpg" name="Chris Quinn" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://cdn/uid/1.jpg')
  })
})
