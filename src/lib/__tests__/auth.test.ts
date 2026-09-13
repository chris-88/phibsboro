import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AuthFailure, mapAuthError, syntheticEmail } from '@/lib/auth'
import { AppError } from '@/lib/errors'

describe('mapAuthError', () => {
  it('maps every duplicate-number shape to duplicate_phone (AC8)', () => {
    // GoTrue phone/email/user-already shapes.
    for (const code of ['user_already_exists', 'phone_exists', 'email_exists']) {
      expect(mapAuthError(new AuthApiError('User already registered', 422, code)).kind).toBe(
        'duplicate_phone',
      )
    }
    // The S1.2 trigger's own 23505 on profiles_phone_key, belt and braces.
    expect(
      mapAuthError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_phone_key"',
      }).kind,
    ).toBe('duplicate_phone')
  })

  it('maps a weak password to weak_password whether typed or class', () => {
    expect(mapAuthError(new AuthWeakPasswordError('too short', 422, ['length'])).kind).toBe(
      'weak_password',
    )
    expect(mapAuthError(new AuthApiError('weak', 422, 'weak_password')).kind).toBe('weak_password')
  })

  it('maps a retryable fetch failure and a bare TypeError to network', () => {
    expect(mapAuthError(new AuthRetryableFetchError('fetch failed', 0)).kind).toBe('network')
    expect(mapAuthError(new TypeError('Failed to fetch')).kind).toBe('network')
  })

  it('maps the join AppError invalid_invite through, and other AppErrors to unknown', () => {
    expect(mapAuthError(new AppError('invalid_invite')).kind).toBe('invalid_invite')
    expect(mapAuthError(new AppError('not_authorised')).kind).toBe('unknown')
  })

  it('passes an AuthFailure through unchanged and defaults anything else to unknown', () => {
    const failure = new AuthFailure('no_session')
    expect(mapAuthError(failure)).toBe(failure)
    expect(mapAuthError({ nope: true }).kind).toBe('unknown')
    expect(mapAuthError(null).kind).toBe('unknown')
  })

  it('keeps the original error on cause and never in the message', () => {
    const cause = new AuthApiError('User already registered', 422, 'user_already_exists')
    const mapped = mapAuthError(cause)
    expect(mapped.cause).toBe(cause)
    expect(mapped.message).toBe('duplicate_phone')
  })
})

describe('syntheticEmail (D19 fallback, unused on path A)', () => {
  it('drops the leading + and appends the invalid domain', () => {
    expect(syntheticEmail('+353871234567')).toBe('353871234567@phibsboro.invalid')
  })
})
