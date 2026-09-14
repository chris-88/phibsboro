import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S7.4 AC16 — the only automated part of the device pass. Reads `index.html` from disk and asserts
 * the two tags that carry iOS install support (D44): Safari reads no manifest icon, so `apple-touch-icon`
 * (180x180) and `apple-mobile-web-app-capable` are the whole of it. Both are easy to lose in a refactor
 * and their absence is invisible until someone tries to install on an iPhone.
 */

// Vitest runs from the repo root; import.meta.url is an http URL under jsdom.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('index.html carries the iOS install tags (AC16)', () => {
  it('declares a 180x180 apple-touch-icon', () => {
    expect(html).toMatch(/<link\s+rel="apple-touch-icon"\s+sizes="180x180"[^>]*>/)
  })

  it('declares apple-mobile-web-app-capable = yes', () => {
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*\/?>/)
  })
})
