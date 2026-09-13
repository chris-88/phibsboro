import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseUrlMissingError, paths } from '@/lib/paths'

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
    vi.resetModules()
  })

  // env.ts parses the environment once at load (S1.5 AC6), so each base needs a fresh import.
  async function withBase(base: string) {
    vi.stubEnv('VITE_APP_BASE_URL', base)
    vi.resetModules()
    return import('@/lib/paths')
  }

  // Both bases the site is actually served from, each with and without the trailing slash.
  const bases = [
    ['https://app.phibsboro.ie', 'https://app.phibsboro.ie'],
    ['https://app.phibsboro.ie/', 'https://app.phibsboro.ie'],
    ['https://chris-88.github.io/phibsboro', 'https://chris-88.github.io/phibsboro'],
    ['https://chris-88.github.io/phibsboro/', 'https://chris-88.github.io/phibsboro'],
  ] as const

  it.each(bases)('eventUrl with base %s', async (base, expected) => {
    const { eventUrl } = await withBase(base)
    const url = eventUrl(ID)
    expect(url).toBe(`${expected}/#/event/${ID}`)
    expect(url.endsWith('/')).toBe(false)
    expect(url.replace('https://', '')).not.toContain('//')
  })

  it('builds join and reset links the same way', async () => {
    const { joinUrl, resetUrl } = await withBase('https://app.phibsboro.ie/')
    expect(joinUrl('tok')).toBe('https://app.phibsboro.ie/#/join/tok')
    expect(resetUrl('tok')).toBe('https://app.phibsboro.ie/#/reset/tok')
  })

  it('an empty or non-URL base is refused at startup, before any link can be built', async () => {
    // Previously BaseUrlMissingError from absoluteUrl(); env.ts now rejects it earlier (S1.5 AC6).
    await expect(withBase('')).rejects.toThrow(/VITE_APP_BASE_URL/)
    await expect(withBase('   /')).rejects.toThrow(/VITE_APP_BASE_URL/)
  })

  it('BaseUrlMissingError is still a named error for the shape a URL parser lets through', () => {
    expect(new BaseUrlMissingError().name).toBe('BaseUrlMissingError')
  })
})
