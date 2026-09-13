import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * D36 / A15: sign-in rate limiting is Supabase's job, and the chosen values are committed beside
 * the migrations so they change under review, not by memory. This asserts the block and a numeric
 * `sign_in_sign_ups` are present; if the CLI ever renames the key, the committed file wins and
 * this test is updated to match (S2.2 AC8).
 */
const toml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

describe('supabase/config.toml [auth.rate_limit] (AC8)', () => {
  it('declares the [auth.rate_limit] block', () => {
    expect(toml).toMatch(/^\[auth\.rate_limit\]/m)
  })

  it('sets a numeric sign_in_sign_ups', () => {
    const match = /^\s*sign_in_sign_ups\s*=\s*(\d+)/m.exec(toml)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBeGreaterThan(0)
  })

  it('sets a numeric token_refresh', () => {
    const match = /^\s*token_refresh\s*=\s*(\d+)/m.exec(toml)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBeGreaterThan(0)
  })
})
