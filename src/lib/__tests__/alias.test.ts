import { describe, expect, it } from 'vitest'
import { CLUB_NAME } from '@/lib/greeting'

describe('scaffold', () => {
  it('resolves the @/ alias at runtime (AC5)', () => {
    expect(CLUB_NAME).toBe('Phibsboro FC')
  })

  it('runs with TZ=UTC so date assertions do not depend on the machine (AC11, D53)', () => {
    expect(new Date().getTimezoneOffset()).toBe(0)
  })
})
