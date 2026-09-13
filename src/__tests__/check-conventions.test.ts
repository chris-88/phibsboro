/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = join(process.cwd(), 'scripts', 'check-conventions.mjs')

/** Runs the real script against a throwaway tree holding one file. */
function check(relPath: string, source: string) {
  const root = mkdtempSync(join(tmpdir(), 'pfc-conventions-'))
  roots.push(root)
  mkdirSync(join(root, relPath, '..'), { recursive: true })
  writeFileSync(join(root, relPath), source)
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr }
}

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('check-conventions standalone rule (S0.4 AC9)', () => {
  it('fails on a stray display-mode: standalone under src/', () => {
    const { status, stderr } = check(
      'src/features/x.ts',
      "export const s = matchMedia('(display-mode: standalone)').matches\n",
    )
    expect(status).toBe(1)
    expect(stderr).toContain('[standalone-check]')
  })

  it('fails on a stray navigator.standalone under src/', () => {
    const { status, stderr } = check('src/x.tsx', 'const ios = navigator.standalone === true\n')
    expect(status).toBe(1)
    expect(stderr).toContain('[standalone-check]')
  })

  it('allows the helper itself', () => {
    const { status } = check(
      'src/lib/standalone.ts',
      "export const isStandalone = () => matchMedia('(display-mode: standalone)').matches\n",
    )
    expect(status).toBe(0)
  })
})

describe('check-conventions release-tag rule (S0.4 AC14)', () => {
  it('fails on a second reader of the pfc-release tag', () => {
    const { status, stderr } = check(
      'src/x.ts',
      'export const v = document.querySelector(\'meta[name="pfc-release"]\')\n',
    )
    expect(status).toBe(1)
    expect(stderr).toContain('[release-tag-reader]')
  })
})

describe('check-conventions setUser rule (S0.6 AC10)', () => {
  it('fails on Sentry.setUser( outside src/lib/sentry.ts', () => {
    const { status, stderr } = check(
      'src/features/auth/x.ts',
      'Sentry.setUser({ id, username: name, phone })\n',
    )
    expect(status).toBe(1)
    expect(stderr).toContain('[sentry-set-user]')
  })

  it('fails on a bare setUser( too', () => {
    const { status, stderr } = check('src/x.tsx', 'setUser({ id: user.id })\n')
    expect(status).toBe(1)
    expect(stderr).toContain('[sentry-set-user]')
  })

  it('allows the wrapper itself', () => {
    const { status } = check(
      'src/lib/sentry.ts',
      'export const setSentryUser = (id: string | null) => Sentry.setUser(id === null ? null : { id })\n',
    )
    expect(status).toBe(0)
  })
})
