import { describe, expect, it } from 'vitest'
import * as keys from '@/api/queryKeys'

describe('query keys (AC15, A6)', () => {
  it('exports exactly three factories', () => {
    expect(Object.keys(keys).sort()).toEqual(['eventKeys', 'teamKeys', 'userKeys'])
  })

  it('every event key starts with the entity segment, so eventKeys.all invalidates them all', () => {
    const id = 'abc'
    for (const key of [
      keys.eventKeys.detail(id),
      keys.eventKeys.preview(id),
      keys.eventKeys.upcoming(id),
      keys.eventKeys.list(id),
      keys.eventKeys.responses(id),
      keys.eventKeys.attendance(id),
      keys.eventKeys.squad(id),
    ]) {
      expect(key[0]).toBe(keys.eventKeys.all[0])
      expect(key).toHaveLength(3)
    }
  })

  it('every team key starts with "teams"', () => {
    expect(keys.teamKeys.detail('t')[0]).toBe('teams')
    expect(keys.teamKeys.members('t')).toEqual(['teams', 't', 'members'])
    expect(keys.teamKeys.invite('t', 'player')).toEqual(['teams', 't', 'invite', 'player'])
    expect(keys.teamKeys.lookup('tok')).toEqual(['teams', 'inviteLookup', 'tok'])
  })

  it('history sits under its own prefix so response invalidation never churns it', () => {
    expect(keys.userKeys.history('u')[0]).toBe('history')
    expect(keys.userKeys.current()).toEqual(['currentUser'])
    expect(keys.userKeys.history('u')[0]).not.toBe(keys.eventKeys.all[0])
  })

  it('keys are distinct per id and per kind', () => {
    expect(keys.eventKeys.preview('a')).not.toEqual(keys.eventKeys.preview('b'))
    expect(keys.eventKeys.preview('a')).not.toEqual(keys.eventKeys.detail('a'))
  })
})
