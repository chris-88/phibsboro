import { describe, expect, it } from 'vitest'
import { installCopy } from '@/features/install/install-copy'

// AC10: the copy lives in one module precisely so the jargon ban is one grep and the length ceiling
// one loop, over one file, rather than a hunt through JSX.
const strings = Object.values(installCopy)

describe('installCopy (AC10, AC11)', () => {
  it('has every string', () => {
    expect(strings.length).toBeGreaterThan(0)
    for (const s of strings) expect(s.trim()).not.toBe('')
  })

  it('never uses the forbidden words (AC10)', () => {
    const banned = /PWA|progressive|manifest|service worker|standalone|shortcut/i
    for (const s of strings) expect(s).not.toMatch(banned)
  })

  it('keeps every sentence under fifteen words (AC11)', () => {
    for (const s of strings) {
      for (const sentence of s.split('.')) {
        const words = sentence.trim().split(/\s+/).filter(Boolean)
        expect(words.length).toBeLessThan(15)
      }
    }
  })

  it('uses full stops, no exclamation marks, no "just" or "simply"', () => {
    for (const s of strings) {
      expect(s).not.toContain('!')
      expect(s).not.toMatch(/\b(just|simply)\b/i)
    }
  })
})
