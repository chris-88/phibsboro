import { describe, expect, it } from 'vitest'
import { paths } from '@/lib/paths'

describe('scaffold', () => {
  it('resolves the @/ alias at runtime (AC5)', () => {
    expect(paths.home()).toBe('/')
  })

  it('runs with TZ=UTC so date assertions do not depend on the machine (AC11, D53)', () => {
    expect(new Date().getTimezoneOffset()).toBe(0)
  })
})
