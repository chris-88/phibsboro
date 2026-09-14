import { describe, expect, it } from 'vitest'
import { canIssueReset } from '@/features/teams/can-issue-reset'
import type { MemberRole } from '@/features/teams/schema'

const target = (over: Partial<Parameters<typeof canIssueReset>[0]> = {}) => ({
  userId: 'u1',
  role: 'player' as MemberRole,
  isManagerElsewhere: false,
  isAdmin: false,
  ...over,
})

const manager = { isAdmin: false, managesThisTeam: true }
const admin = { isAdmin: true, managesThisTeam: false }

describe('canIssueReset — the D10 truth table', () => {
  it('manager may reset a plain player on their team', () => {
    expect(canIssueReset(target(), manager)).toBe(true)
  })

  it('manager may not reset a co-manager (role manager on this team)', () => {
    expect(canIssueReset(target({ role: 'manager' }), manager)).toBe(false)
  })

  it('manager may not reset an admin', () => {
    expect(canIssueReset(target({ isAdmin: true }), manager)).toBe(false)
  })

  it('manager may not reset a player who manages another team', () => {
    expect(canIssueReset(target({ isManagerElsewhere: true }), manager)).toBe(false)
  })

  it('manager may not reset anyone on a team they do not manage', () => {
    expect(canIssueReset(target(), { isAdmin: false, managesThisTeam: false })).toBe(false)
  })

  it('admin may reset a manager', () => {
    expect(canIssueReset(target({ role: 'manager' }), admin)).toBe(true)
  })

  it('admin may reset a player', () => {
    expect(canIssueReset(target(), admin)).toBe(true)
  })

  it('admin may not reset another admin', () => {
    expect(canIssueReset(target({ isAdmin: true }), admin)).toBe(false)
  })
})
