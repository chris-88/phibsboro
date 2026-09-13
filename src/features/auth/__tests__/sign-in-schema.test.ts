import { describe, expect, it } from 'vitest'
import { registerSchema, signInSchema } from '@/features/auth/schema'

/** The four spellings a player might type. Both schemas must fold them to the one E.164 string
 *  through the same `phoneField`, or someone is locked out of an account they hold (S2.2 AC2). */
const SPELLINGS = ['087 123 4567', '0871234567', '+353 87 123 4567', '+353871234567'] as const

describe('signInSchema phone normalisation parity with registerSchema (AC2)', () => {
  it('folds every spelling to the identical string through both schemas', () => {
    for (const phone of SPELLINGS) {
      const signIn = signInSchema.parse({ phone, password: 'x' })
      const register = registerSchema.parse({ name: 'Aoife', phone, password: 'longenough' })
      expect(signIn.phone).toBe('+353871234567')
      expect(register.phone).toBe(signIn.phone)
    }
  })

  it('accepts a one-character password: sign-in never re-validates an old account', () => {
    expect(signInSchema.safeParse({ phone: '0871234567', password: 'x' }).success).toBe(true)
    expect(signInSchema.safeParse({ phone: '0871234567', password: '' }).success).toBe(false)
  })

  it('rejects a non-mobile before any network call, the same as registration', () => {
    for (const phone of ['01 234 5678', 'abc', '']) {
      expect(signInSchema.safeParse({ phone, password: 'x' }).success).toBe(false)
    }
  })
})
