import { describe, expect, it } from 'vitest'
import * as keys from '@/api/queryKeys'

describe('query keys (AC15, A6)', () => {
  it('exports exactly six factories', () => {
    expect(Object.keys(keys).sort()).toEqual([
      'eventKeys',
      'feedbackKeys',
      'statsKeys',
      'subsKeys',
      'teamKeys',
      'userKeys',
    ])
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

  it('user keys sit outside the events prefix so a response write never churns them', () => {
    expect(keys.userKeys.current()).toEqual(['currentUser'])
    expect(keys.userKeys.allUsers()).toEqual(['adminUsers'])
    expect(keys.userKeys.current()[0]).not.toBe(keys.eventKeys.all[0])
  })

  it('keys are distinct per id and per kind', () => {
    expect(keys.eventKeys.preview('a')).not.toEqual(keys.eventKeys.preview('b'))
    expect(keys.eventKeys.preview('a')).not.toEqual(keys.eventKeys.detail('a'))
  })
})
