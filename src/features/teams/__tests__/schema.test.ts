import { describe, expect, it } from 'vitest'
import {
  byActiveThenName,
  byRoleThenName,
  correctPhoneSchema,
  createTeamInput,
  memberDirectoryRowSchema,
  teamColourSchema,
  teamNameSchema,
} from '@/features/teams/schema'
import { TEAM_COLOUR_DEFAULT, TEAM_PALETTE, teamColourName } from '@/features/teams/palette'

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

const UUID = '00000000-0000-4000-8000-000000000001'
const row = (over: Record<string, unknown> = {}) => ({
  user_id: UUID,
  name: 'Someone',
  role: 'player',
  joined_at: '2026-01-01T00:00:00Z',
  phone: '+353871234567',
  ...over,
})

describe('memberDirectoryRowSchema (S6.4)', () => {
  it('accepts a null phone — the non-manager case (D8)', () => {
    expect(memberDirectoryRowSchema.parse(row({ phone: null })).phone).toBeNull()
  })

  it('rejects a role of admin (D2)', () => {
    expect(memberDirectoryRowSchema.safeParse(row({ role: 'admin' })).success).toBe(false)
  })

  it('accepts player and manager', () => {
    expect(memberDirectoryRowSchema.parse(row({ role: 'manager' })).role).toBe('manager')
  })
})

describe('byRoleThenName (AC1)', () => {
  const m = (role: 'player' | 'manager', name: string) => ({ role, name })

  it('puts every manager before every player', () => {
    const rows = [m('player', 'Aaron'), m('manager', 'Zoe')]
    expect([...rows].sort(byRoleThenName).map((r) => r.name)).toEqual(['Zoe', 'Aaron'])
  })

  it('orders case-insensitively within a role group', () => {
    const rows = [m('player', 'bob'), m('player', 'Alice'), m('manager', 'declan')]
    expect([...rows].sort(byRoleThenName).map((r) => r.name)).toEqual(['declan', 'Alice', 'bob'])
  })
})

describe('correctPhoneSchema (AC9)', () => {
  it('normalises 087 123 4567 to E.164', () => {
    expect(correctPhoneSchema.parse({ phone: '087 123 4567' })).toEqual({
      phone: '+353871234567',
    })
  })

  it('normalises +353 87 123 4567 to E.164', () => {
    expect(correctPhoneSchema.parse({ phone: '+353 87 123 4567' })).toEqual({
      phone: '+353871234567',
    })
  })

  it('rejects nonsense with the exact AC9 copy', () => {
    const res = correctPhoneSchema.safeParse({ phone: 'not a number' })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe("That doesn't look like a mobile number.")
    }
  })
})

describe('teamColourSchema and TEAM_PALETTE (S10.1 AC3)', () => {
  it('accepts every palette value', () => {
    for (const entry of TEAM_PALETTE) {
      expect(teamColourSchema.safeParse(entry.value).success).toBe(true)
    }
  })

  it('rejects an off-palette hex and a malformed value', () => {
    // A valid 6-digit hex not present in the palette (built so no hex literal sits in the test).
    const offPalette = `#${'a'.repeat(6)}`
    expect(TEAM_PALETTE.some((c) => c.value === offPalette)).toBe(false)
    expect(teamColourSchema.safeParse(offPalette).success).toBe(false)
    expect(teamColourSchema.safeParse('not-a-hex').success).toBe(false)
    expect(teamColourSchema.safeParse('').success).toBe(false)
  })

  it('the default is a palette member', () => {
    expect(TEAM_PALETTE.some((c) => c.value === TEAM_COLOUR_DEFAULT)).toBe(true)
  })

  it('palette values are unique 6-digit hexes', () => {
    const values = TEAM_PALETTE.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) expect(v).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('teamColourName maps a value to its label and falls back to the raw value', () => {
    const unknown = `#${'0'.repeat(6)}`
    expect(teamColourName(TEAM_COLOUR_DEFAULT)).toBe('Blue')
    expect(teamColourName(unknown)).toBe(unknown)
  })
})
