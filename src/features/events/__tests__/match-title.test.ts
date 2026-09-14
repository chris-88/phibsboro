import { describe, expect, it } from 'vitest'
import { matchTitle } from '@/features/events/match-title'

describe('matchTitle (S8.2, V3)', () => {
  it('puts the home team first', () => {
    expect(matchTitle({ teamName: 'Firsts', opponent: 'Kilbarrack', homeAway: 'home' })).toBe(
      'Firsts v Kilbarrack',
    )
  })

  it('puts the away team second, opponent first', () => {
    expect(matchTitle({ teamName: 'Firsts', opponent: 'Kilbarrack', homeAway: 'away' })).toBe(
      'Kilbarrack v Firsts',
    )
  })

  it('defaults the separator to on-screen "v" and takes "vs" for the share', () => {
    expect(matchTitle({ teamName: 'Firsts', opponent: 'Kilbarrack', homeAway: 'home' })).toContain(
      ' v ',
    )
    expect(
      matchTitle({ teamName: 'Firsts', opponent: 'Kilbarrack', homeAway: 'home', sep: 'vs' }),
    ).toBe('Firsts vs Kilbarrack')
  })

  it('trims and collapses whitespace in both names', () => {
    expect(
      matchTitle({ teamName: '  Firsts  ', opponent: 'St   Kevins  Boys', homeAway: 'home' }),
    ).toBe('Firsts v St Kevins Boys')
  })

  it('returns a partial string for an empty opponent (submit is blocked by the schema)', () => {
    expect(matchTitle({ teamName: 'Firsts', opponent: '', homeAway: 'home' })).toBe('Firsts v')
    expect(matchTitle({ teamName: 'Firsts', opponent: '   ', homeAway: 'away' })).toBe('v Firsts')
  })
})
