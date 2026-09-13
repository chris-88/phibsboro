import { describe, expect, it } from 'vitest'
import css from '@/index.css?raw'
import { ICON_FILES, manifestFor } from '@/pwa/manifest'

/** The hex token S0.2 declares for the manifest; the manifest repeats it because a
 *  manifest cannot read CSS, and this test is what stops the two drifting. */
function cssHex(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)
  if (!match?.[1]) throw new Error(`--${name} is missing from src/index.css`)
  return match[1].toLowerCase()
}

describe('manifest (AC1)', () => {
  const manifest = manifestFor('/')

  it('has the agreed identity fields', () => {
    expect(manifest.name).toBe('Phibsboro FC')
    expect(manifest.short_name).toBe('Phibsboro')
    expect(manifest.display).toBe('standalone')
    expect(manifest.id).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
  })

  it('takes its colours from the S0.2 tokens', () => {
    expect(manifest.theme_color.toLowerCase()).toBe(cssHex('pwa-theme-color'))
    expect(manifest.background_color.toLowerCase()).toBe(cssHex('pwa-background-color'))
  })

  it('declares 192 and 512 `any` icons and a 512 maskable one (AC2)', () => {
    expect(manifest.icons.map((i) => [i.sizes, i.purpose])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ])
    expect(manifest.icons.every((i) => i.type === 'image/png')).toBe(true)
    expect(manifest.icons).toHaveLength(ICON_FILES.length)
  })

  // The same build must be right on the custom domain and on the Pages project page
  // (S0.5 deviation). vite-plugin-pwa does not resolve these against `base` for us.
  it('resolves id, start_url, scope and icon paths against the Vite base', () => {
    const sub = manifestFor('/phibsboro/')
    expect(sub.id).toBe('/phibsboro/')
    expect(sub.start_url).toBe('/phibsboro/')
    expect(sub.scope).toBe('/phibsboro/')
    expect(sub.icons.map((i) => i.src)).toEqual([
      '/phibsboro/icons/icon-192.png',
      '/phibsboro/icons/icon-512.png',
      '/phibsboro/icons/icon-512-maskable.png',
    ])
    expect(manifest.icons.map((i) => i.src)).toEqual([
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-512-maskable.png',
    ])
  })

  it('refuses a base that is not slash-wrapped, so a bad VITE_BASE_PATH fails the build', () => {
    expect(() => manifestFor('phibsboro')).toThrow(/Vite base/)
    expect(() => manifestFor('/phibsboro')).toThrow(/Vite base/)
  })
})
