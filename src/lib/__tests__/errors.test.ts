import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { APP_ERROR_CODES, AppError, mapRpcError, toAppError } from '@/lib/errors'

const pg = (message: string, code = 'P0001'): PostgrestError =>
  ({ message, code, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError

const SIX = [
  'invalid_invite',
  'invalid_token',
  'not_authorised',
  'phone_taken',
  'series_too_long',
  'starts_in_past',
] as const

describe('toAppError (AC9)', () => {
  it.each(SIX)('maps the raised word %s to its code and keeps the original on cause', (word) => {
    const error = toAppError(pg(word))
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe(word)
    expect(error.cause).toEqual(pg(word))
  })

  it('maps anything else to unknown, keeping the Postgres detail on cause and never in message', () => {
    const raw = pg('new row violates row-level security policy for table "events"', '42501')
    const error = toAppError(raw)
    expect(error.code).toBe('unknown')
    expect(error.message).toBe('unknown')
    expect(error.message).not.toContain('events')
    expect(error.cause).toBe(raw)
  })

  it('a duplicate key or a check constraint never leaks its constraint name', () => {
    const error = toAppError(
      pg('duplicate key value violates unique constraint "profiles_phone_key"', '23505'),
    )
    expect(error.code).toBe('unknown')
    expect(mapRpcError(error.code)).not.toContain('profiles_phone_key')
  })

  it('matches the whole message, not a substring', () => {
    expect(toAppError(pg('invalid_invite: expired')).code).toBe('unknown')
    expect(toAppError(pg('unknown')).code).toBe('unknown')
  })

  it('a null error is still unknown rather than a crash', () => {
    expect(toAppError(null).code).toBe('unknown')
  })
})

describe('mapRpcError (AC10)', () => {
  it('has a line for every code', () => {
    for (const code of APP_ERROR_CODES) expect(mapRpcError(code).length).toBeGreaterThan(0)
  })

  it('both token codes share the one line', () => {
    const line = "That link's no good. Ask your manager for a new one."
    expect(mapRpcError('invalid_invite')).toBe(line)
    expect(mapRpcError('invalid_token')).toBe(line)
  })

  it('the other four and unknown are fixed copy', () => {
    expect(mapRpcError('not_authorised')).toBe("You can't do that.")
    expect(mapRpcError('phone_taken')).toBe('That number is already registered.')
    expect(mapRpcError('series_too_long')).toBe("That's too many sessions. Pick a shorter run.")
    expect(mapRpcError('starts_in_past')).toBe('Pick a date in the future.')
    expect(mapRpcError('unknown')).toBe('Something went wrong. Try again.')
  })
})
