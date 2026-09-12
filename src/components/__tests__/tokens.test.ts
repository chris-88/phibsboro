import { describe, expect, it } from 'vitest'
import css from '@/index.css?raw'
import { contrastRatio, readOklchTokens, toHex } from '@/test/contrast'

const tokens = readOklchTokens(css)

const get = (name: string) => {
  const value = tokens[name]
  if (!value) throw new Error(`Token --${name} is missing from src/index.css`)
  return value
}

// WCAG AA: 4.5:1 for body text, 3:1 for large text and icons. Every pair below is one a
// component actually renders — the shell, the nav, and the three state components.
describe('token contrast (AC11)', () => {
  const pairs: [string, string, number][] = [
    ['foreground', 'background', 4.5],
    ['card-foreground', 'card', 4.5],
    ['muted-foreground', 'background', 4.5],
    ['secondary-foreground', 'secondary', 4.5],
    ['primary-foreground', 'primary', 4.5],
    ['success-foreground', 'success', 4.5],
    ['destructive', 'background', 4.5],
    ['primary', 'background', 4.5],
  ]

  it.each(pairs)('%s on %s meets %s:1', (fg, bg, minimum) => {
    expect(contrastRatio(get(fg), get(bg))).toBeGreaterThanOrEqual(minimum)
  })
})

describe('token stylesheet (AC4)', () => {
  it('carries the tap-target spacing token, so min-h-tap exists', () => {
    expect(css).toMatch(/--spacing-tap:\s*2\.75rem/)
  })

  it('names the brand hue on exactly one line, so restyling is a one-line edit', () => {
    const brandLines = css.split('\n').filter((line) => /^\s*--primary:/.test(line))
    expect(brandLines).toHaveLength(1)
  })

  it('ships no .dark token block; v1 is light only', () => {
    expect(css).toContain('color-scheme: light')
    expect(css).not.toMatch(/^\.dark\s*\{/m)
  })
})

// S0.4's manifest cannot read CSS, so it repeats these two values. This test is the
// record of what it must repeat.
describe('PWA colours (S0.4 reads these)', () => {
  it('--pwa-theme-color is --primary in hex', () => {
    expect(css).toContain(`--pwa-theme-color: ${toHex(get('primary'))}`)
  })

  it('--pwa-background-color is --background in hex', () => {
    expect(css).toContain(`--pwa-background-color: ${toHex(get('background'))}`)
  })
})
