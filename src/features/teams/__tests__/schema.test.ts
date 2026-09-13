import { describe, expect, it } from 'vitest'
import { byActiveThenName, createTeamInput, teamNameSchema } from '@/features/teams/schema'

describe('teamNameSchema (AC2, AC3)', () => {
  it('trims surrounding whitespace', () => {
    expect(teamNameSchema.parse('  Firsts  ')).toBe('Firsts')
  })

  it('accepts a 60-character name and rejects 61', () => {
    expect(teamNameSchema.parse('a'.repeat(60))).toHaveLength(60)
    expect(teamNameSchema.safeParse('a'.repeat(61)).success).toBe(false)
  })

  it('rejects empty and whitespace-only names', () => {
    expect(teamNameSchema.safeParse('').success).toBe(false)
    expect(teamNameSchema.safeParse('   ').success).toBe(false)
  })

  it('the create input carries the same rule on its name field', () => {
    expect(createTeamInput.parse({ name: '  Seconds ' })).toEqual({ name: 'Seconds' })
    expect(createTeamInput.safeParse({ name: '  ' }).success).toBe(false)
  })
})

describe('byActiveThenName (AC8)', () => {
  const team = (name: string, active: boolean) => ({ name, active })

  it('orders case-insensitively within a section', () => {
    const rows = [team('seconds', true), team('Firsts', true)]
    expect([...rows].sort(byActiveThenName).map((t) => t.name)).toEqual(['Firsts', 'seconds'])
  })

  it('puts every inactive team after every active one', () => {
    const rows = [team('Alpha', false), team('zulu', true)]
    expect([...rows].sort(byActiveThenName).map((t) => t.name)).toEqual(['zulu', 'Alpha'])
  })
})
