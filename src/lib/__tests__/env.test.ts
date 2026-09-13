import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnvError, parseEnv } from '@/lib/env'

const good = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
  VITE_APP_BASE_URL: 'https://app.phibsboro.ie',
  VITE_SENTRY_DSN: '',
  VITE_SENTRY_RELEASE: '',
  VITE_SENTRY_ENVIRONMENT: '',
}

describe('env (AC6)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('parses the documented shape and turns blank optionals into undefined', () => {
    const env = parseEnv(good)
    expect(env.VITE_SUPABASE_URL).toBe(good.VITE_SUPABASE_URL)
    expect(env.VITE_SENTRY_DSN).toBeUndefined()
    expect(env.VITE_SENTRY_RELEASE).toBeUndefined()
  })

  it('a missing variable throws a named, readable error naming the key', () => {
    const rest = { ...good, VITE_SUPABASE_URL: undefined }
    expect(() => parseEnv(rest)).toThrow(EnvError)
    expect(() => parseEnv(rest)).toThrow(/VITE_SUPABASE_URL/)
    expect(() => parseEnv(rest)).toThrow(/\.env\.example/)
  })

  it('a malformed variable is refused too', () => {
    expect(() => parseEnv({ ...good, VITE_SUPABASE_URL: 'not a url' })).toThrow(/VITE_SUPABASE_URL/)
    expect(() => parseEnv({ ...good, VITE_SUPABASE_ANON_KEY: 'short' })).toThrow(
      /VITE_SUPABASE_ANON_KEY/,
    )
    expect(() => parseEnv({ ...good, VITE_SENTRY_DSN: 'nope' })).toThrow(/VITE_SENTRY_DSN/)
  })

  it('the module itself throws at import when the environment is broken', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.resetModules()
    // A fresh module graph has its own EnvError class, so match on name and message.
    await expect(import('@/lib/env')).rejects.toMatchObject({
      name: 'EnvError',
      message: expect.stringContaining('VITE_SUPABASE_ANON_KEY') as string,
    })
  })

  it('the module itself loads under the hermetic test environment', async () => {
    vi.resetModules()
    const { env } = await import('@/lib/env')
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
  })
})
