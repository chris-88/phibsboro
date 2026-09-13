import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S2.6 / D59: session longevity is configuration, and the config-drift guard is what keeps D59's
 * claim true without waiting a season to find out. This parses the committed `supabase/config.toml`
 * and fails if the four values the story pins ever drift. It runs under `npm test`, which is the
 * `check` job, so the assertion is in CI (AC1, AC17). The hosted project's matching values live in
 * `docs/supabase-config.md`, because `config.toml` is never pushed to it.
 */
const toml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

function value(key: string): string | null {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm').exec(toml)
  return match ? (match[1] ?? null) : null
}

describe('supabase/config.toml session settings (AC1, AC17)', () => {
  it('sets jwt_expiry to 3600 — a one-hour access token, then a silent refresh', () => {
    expect(value('jwt_expiry')).toBe('3600')
  })

  it('enables refresh token rotation', () => {
    expect(value('enable_refresh_token_rotation')).toBe('true')
  })

  it('sets a numeric refresh_token_reuse_interval so a resume double-fire is tolerated', () => {
    const raw = value('refresh_token_reuse_interval')
    expect(raw).not.toBeNull()
    expect(Number(raw)).toBeGreaterThan(0)
  })

  it('declares the [auth.sessions] block', () => {
    expect(toml).toMatch(/^\[auth\.sessions\]/m)
  })

  it('sets no absolute session cap — never logged out mid-season', () => {
    expect(value('timebox')).toBe('"0h"')
  })

  it('sets a 365-day inactivity window', () => {
    // 8760h = 365 days. A finite, reviewable value (the hosted project runs 0 = unbounded; see
    // docs/supabase-config.md). Either satisfies the full-season claim.
    expect(value('inactivity_timeout')).toBe('"8760h"')
  })
})
