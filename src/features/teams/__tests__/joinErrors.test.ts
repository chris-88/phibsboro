import { describe, expect, it } from 'vitest'
import { classifyJoinError } from '@/features/teams/joinErrors'
import { AppError } from '@/lib/errors'

describe('classifyJoinError (AC9, AC12)', () => {
  it('maps a raised invalid_invite to invalid', () => {
    expect(classifyJoinError(new AppError('invalid_invite'))).toBe('invalid')
  })

  it('maps a fetch failure to network', () => {
    expect(classifyJoinError(new TypeError('Failed to fetch'))).toBe('network')
  })

  it('maps any other AppError code to network, so only a dead link is terminal', () => {
    expect(classifyJoinError(new AppError('unknown'))).toBe('network')
  })

  it('maps a non-error value to network', () => {
    expect(classifyJoinError(null)).toBe('network')
  })
})
