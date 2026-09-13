import { describe, expect, it } from 'vitest'
import { passwordHint } from '@/features/auth/password-hint'

describe('passwordHint boundaries', () => {
  it('is short below 8, ok from 8, better from 12', () => {
    expect(passwordHint('a'.repeat(7))).toBe('short')
    expect(passwordHint('a'.repeat(8))).toBe('ok')
    expect(passwordHint('a'.repeat(11))).toBe('ok')
    expect(passwordHint('a'.repeat(12))).toBe('better')
  })

  it('treats the empty string as short', () => {
    expect(passwordHint('')).toBe('short')
  })
})
