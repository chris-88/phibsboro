import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseUrlMissingError, absoluteUrl, eventUrl, joinUrl, paths, resetUrl } from '@/lib/paths'

const ID = '9f1c0b8e-0000-4000-8000-000000000000'

describe('paths', () => {
  it('builds every in-app path', () => {
    expect(paths.home()).toBe('/')
    expect(paths.login()).toBe('/login')
    expect(paths.register()).toBe('/register')
    expect(paths.join('abc')).toBe('/join/abc')
    expect(paths.reset('abc')).toBe('/reset/abc')
    expect(paths.event(ID)).toBe(`/event/${ID}`)
    expect(paths.history()).toBe('/history')
    expect(paths.manage()).toBe('/manage')
    expect(paths.newEvent()).toBe('/manage/event/new')
    expect(paths.manageEvent(ID)).toBe(`/manage/event/${ID}`)
    expect(paths.teamMembers(ID)).toBe(`/manage/team/${ID}/members`)
    expect(paths.admin()).toBe('/admin')
  })
})

describe('absolute URLs (AC9, D13)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // Both bases the site is actually served from, each with and without the trailing slash.
  const bases = [
    ['https://app.phibsboro.ie', 'https://app.phibsboro.ie'],
    ['https://app.phibsboro.ie/', 'https://app.phibsboro.ie'],
    ['https://chris-88.github.io/phibsboro', 'https://chris-88.github.io/phibsboro'],
    ['https://chris-88.github.io/phibsboro/', 'https://chris-88.github.io/phibsboro'],
  ] as const

  it.each(bases)('eventUrl with base %s', (base, expected) => {
    vi.stubEnv('VITE_APP_BASE_URL', base)
    const url = eventUrl(ID)
    expect(url).toBe(`${expected}/#/event/${ID}`)
    expect(url.endsWith('/')).toBe(false)
    expect(url.replace('https://', '')).not.toContain('//')
  })

  it('builds join and reset links the same way', () => {
    vi.stubEnv('VITE_APP_BASE_URL', 'https://app.phibsboro.ie/')
    expect(joinUrl('tok')).toBe('https://app.phibsboro.ie/#/join/tok')
    expect(resetUrl('tok')).toBe('https://app.phibsboro.ie/#/reset/tok')
  })

  it('throws a named error rather than returning a relative link when the base is empty', () => {
    vi.stubEnv('VITE_APP_BASE_URL', '')
    expect(() => absoluteUrl(paths.event(ID))).toThrow(BaseUrlMissingError)
    vi.stubEnv('VITE_APP_BASE_URL', '   /')
    expect(() => eventUrl(ID)).toThrow(BaseUrlMissingError)
  })
})
