import { describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { AppError } from '@/lib/errors'

describe('query client defaults (D23, D48)', () => {
  const defaults = queryClient.getDefaultOptions()

  it('never retries an AppError: the database has already decided', () => {
    const retry = defaults.queries?.retry
    expect(typeof retry).toBe('function')
    if (typeof retry !== 'function') return
    expect(retry(0, new AppError('not_authorised'))).toBe(false)
    expect(retry(0, new AppError('unknown'))).toBe(false)
  })

  it('retries anything else twice', () => {
    const retry = defaults.queries?.retry
    if (typeof retry !== 'function') throw new Error('retry is not a function')
    const network = new TypeError('Failed to fetch')
    expect(retry(0, network)).toBe(true)
    expect(retry(1, network)).toBe(true)
    expect(retry(2, network)).toBe(false)
  })

  it('polls on focus with a 30 s stale window and no mutation retry', () => {
    expect(defaults.queries?.staleTime).toBe(30_000)
    expect(defaults.queries?.gcTime).toBe(5 * 60_000)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
    expect(defaults.mutations?.retry).toBe(0)
  })
})
