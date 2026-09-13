/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd() // Vitest runs from the repository root
const FORBIDDEN = /\b(Notification|pushManager|periodicSync)\b/

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx|js|mjs|html)$/.test(entry)) yield full
  }
}

// Out of scope in the brief: push, notifications, background and periodic sync. Nothing here
// requests them, not even a TODO. The grep runs over the source and, when a build is present,
// over the generated worker as well.
describe('no push, notification or sync surface (AC13)', () => {
  it('appears nowhere under src/', () => {
    const hits = [...walk(join(ROOT, 'src'))]
      .filter((f) => !f.endsWith('no-push.test.ts'))
      .filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })

  it('appears nowhere in the generated service worker', () => {
    const sw = join(ROOT, 'dist', 'sw.js')
    if (!existsSync(sw)) return // `npm test` runs before `npm run build` on a clean checkout
    const workers = readdirSync(join(ROOT, 'dist'))
      .filter((f) => f === 'sw.js' || /^workbox-.*\.js$/.test(f))
      .map((f) => readFileSync(join(ROOT, 'dist', f), 'utf8'))
    expect(workers.length).toBeGreaterThanOrEqual(2)
    for (const source of workers) expect(source).not.toMatch(FORBIDDEN)
  })
})
