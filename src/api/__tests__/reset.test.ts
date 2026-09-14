import { describe, expect, it } from 'vitest'
import { ResetFailure, mapResetError } from '@/api/reset'
import { AppError } from '@/lib/errors'
import { resetUrl } from '@/lib/paths'

describe('mapResetError', () => {
  it('maps an AppError with code not_authorised', () => {
    expect(mapResetError(new AppError('not_authorised')).kind).toBe('not_authorised')
  })

  it('maps an AppError with code invalid_token', () => {
    expect(mapResetError(new AppError('invalid_token')).kind).toBe('invalid_token')
  })

  it('maps a raw PostgrestError message not_authorised', () => {
    expect(mapResetError({ message: 'not_authorised' }).kind).toBe('not_authorised')
  })

  it('maps a raw PostgrestError message invalid_token', () => {
    expect(mapResetError({ message: 'invalid_token' }).kind).toBe('invalid_token')
  })

  it('maps a fetch failure to network', () => {
    expect(mapResetError(new TypeError('Failed to fetch')).kind).toBe('network')
  })

  it('maps an unrecognised Postgres error to unknown', () => {
    expect(mapResetError(new AppError('phone_taken')).kind).toBe('unknown')
    expect(mapResetError({ message: 'some other thing' }).kind).toBe('unknown')
  })

  it('passes a ResetFailure through unchanged', () => {
    const f = new ResetFailure('invalid_token')
    expect(mapResetError(f)).toBe(f)
  })

  it('is an Error subclass so it satisfies only-throw-error', () => {
    expect(new ResetFailure('unknown')).toBeInstanceOf(Error)
  })
})

describe('resetUrl for the issued token', () => {
  it('does not double-encode a base64url token', () => {
    const token = 'aB3-dE5_fG7hJ9kL1mN3pQ5rS7tU9vW1xY3z'
    const url = resetUrl(token)
    // The token appears verbatim at the tail, with no %2D / %5F / %25 escaping of - _ or a stray %.
    expect(url.endsWith(`/reset/${token}`)).toBe(true)
    expect(url).not.toContain('%')
  })
})
