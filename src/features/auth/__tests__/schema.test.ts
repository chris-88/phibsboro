import { describe, expect, it } from 'vitest'
import { registerSchema } from '@/features/auth/schema'

const base = { name: 'Aoife Byrne', password: 'longenough' }

describe('registerSchema phone normalisation (AC4)', () => {
  it('normalises every Irish mobile spelling to the same E.164 string', () => {
    for (const phone of ['087 123 4567', '0871234567', '+353 87 123 4567', '+353871234567']) {
      const parsed = registerSchema.parse({ ...base, phone })
      expect(parsed.phone).toBe('+353871234567')
    }
  })

  it('rejects a landline, a short number and free text before any network call', () => {
    for (const phone of ['01 234 5678', 'abc', '', '12345']) {
      const result = registerSchema.safeParse({ ...base, phone })
      expect(result.success).toBe(false)
    }
  })
})

describe('registerSchema name and password', () => {
  it('trims the name and rejects a blank one', () => {
    const parsed = registerSchema.parse({ ...base, name: '  Aoife  ', phone: '0871234567' })
    expect(parsed.name).toBe('Aoife')
    expect(registerSchema.safeParse({ ...base, name: '   ', phone: '0871234567' }).success).toBe(
      false,
    )
  })

  it('blocks a password under 8 characters and accepts 8 or more, any characters (AC6)', () => {
    expect(
      registerSchema.safeParse({ ...base, password: '1234567', phone: '0871234567' }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({ ...base, password: '12345678', phone: '0871234567' }).success,
    ).toBe(true)
  })

  it('does not trim the password', () => {
    const parsed = registerSchema.parse({ ...base, password: ' spaced  ', phone: '0871234567' })
    expect(parsed.password).toBe(' spaced  ')
  })
})
