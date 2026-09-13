/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APPLE_TOUCH_ICON, ICON_FILES, manifestFor } from '@/pwa/manifest'

// Vitest runs from the repository root; import.meta.url is an http URL under jsdom.
const root = (path: string) => join(process.cwd(), path)

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Width and height from the IHDR chunk: bytes 16-23, two big-endian uint32s. */
function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${path} is not a PNG`).toBe(true)
  expect(bytes.subarray(12, 16).toString('latin1'), `${path} has no IHDR chunk`).toBe('IHDR')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('icons (AC2)', () => {
  it.each(ICON_FILES)('public/$file is a real $size x $size PNG', ({ file, size }) => {
    expect(pngDimensions(root(`public/${file}`))).toEqual({ width: size, height: size })
  })

  it('every manifest icon is backed by a file of the declared size', () => {
    for (const icon of manifestFor('/').icons) {
      const [w, h] = icon.sizes.split('x').map(Number)
      expect(pngDimensions(root(`public${icon.src}`))).toEqual({ width: w, height: h })
    }
  })

  it('public/apple-touch-icon.png is 180 x 180', () => {
    expect(pngDimensions(root(`public/${APPLE_TOUCH_ICON.file}`))).toEqual({
      width: 180,
      height: 180,
    })
  })
})

// The whole of the automated iOS coverage (D44): Safari reads none of the manifest icons.
describe('index.html iOS and theme tags (AC3)', () => {
  const html = readFileSync(root('index.html'), 'utf8')
  const meta = (name: string) =>
    new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`).exec(html)?.[1]

  it('links the 180 x 180 apple-touch-icon', () => {
    expect(html).toMatch(
      /<link\s+rel="apple-touch-icon"\s+sizes="180x180"\s+href="\/apple-touch-icon\.png"/,
    )
  })

  it('declares the app capable and names it for the home screen', () => {
    expect(meta('apple-mobile-web-app-capable')).toBe('yes')
    expect(meta('apple-mobile-web-app-title')).toBe('Phibsboro')
  })

  it('carries a theme-color equal to the manifest theme_color', () => {
    expect(meta('theme-color')?.toLowerCase()).toBe(manifestFor('/').theme_color.toLowerCase())
  })

  it('does not hardcode the manifest link — the plugin injects it with the right base', () => {
    expect(html).not.toContain('rel="manifest"')
  })
})
