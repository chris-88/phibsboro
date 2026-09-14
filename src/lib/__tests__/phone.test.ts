import { describe, expect, it } from 'vitest'
import { toE164 } from '@/lib/phone'

// The accepted table, shared so the idempotence loop (S7.2 AC4) runs over every one of them
// rather than a single case someone remembered.
const ACCEPTED: [input: string, expected: string][] = [
  ['087 123 4567', '+353871234567'],
  ['+353 87 123 4567', '+353871234567'],
  ['00353871234567', '+353871234567'],
  ['(087)1234567', '+353871234567'],
  ['0871234567', '+353871234567'],
  ['353871234567', '+353871234567'],
  ['  087-123-4567  ', '+353871234567'],
  ['087 123–4567', '+353871234567'], // non-breaking space, en dash
  ['087.123.4567', '+353871234567'],
  ['083 123 4567', '+353831234567'],
  ['085 123 4567', '+353851234567'],
  ['086 123 4567', '+353861234567'],
  ['089 123 4567', '+353891234567'],
  ['+44 7911 123456', '+447911123456'], // a non-Irish E.164 passes the general form, preserved unchanged
]

describe('toE164 (AC14, D35)', () => {
  it.each(ACCEPTED)('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected)
  })

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['12345', 'too short and no trunk prefix'],
    ['087123456789', 'too many digits for an Irish mobile'],
    ['08712345', 'too few digits for an Irish mobile'],
    ['letters', 'no digits'],
    ['014567890', 'a Dublin landline'],
    ['+35314567890', 'a landline in international form'],
    ['088 123 4567', 'not an Irish mobile prefix'],
    ['081 123 4567', 'not an Irish mobile prefix (081)'],
    ['871234567', 'no trunk zero and no country code'],
    ['+0871234567', 'a plus followed by a zero'],
    ['0', 'a lone zero'],
    ['+', 'a lone plus'],
  ])('%s → null (%s)', (input) => {
    expect(toE164(input)).toBeNull()
  })

  it('is idempotent: normalising an E.164 result returns the same value', () => {
    const once = toE164('087 123 4567')
    expect(once).not.toBeNull()
    expect(toE164(once ?? '')).toBe(once)
  })

  // S7.2 AC4 — idempotence over every accepted input, not just one: toE164(toE164(x)!) === toE164(x).
  it.each(ACCEPTED)('is idempotent for %s', (input) => {
    const once = toE164(input)
    expect(once).not.toBeNull()
    expect(toE164(once ?? '')).toBe(once)
  })

  it('the sign-in case: a number typed one way at signup and another at sign-in agree (S2.2)', () => {
    expect(toE164('+353 87 123 4567')).toBe(toE164('087 123 4567'))
  })
})
