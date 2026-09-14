import { describe, expect, it } from 'vitest'
import { deriveCounts } from '@/lib/counts'
import {
  buildRoster,
  type RosterAttendance,
  type RosterMember,
  type RosterResponse,
} from '@/lib/roster'

const member = (userId: string, name: string): RosterMember => ({ userId, name, role: 'player' })
const available = (userId: string): RosterResponse => ({ userId, response: 'available' })
const unavailable = (userId: string): RosterResponse => ({ userId, response: 'unavailable' })
const attended = (userId: string, value: boolean): RosterAttendance => ({ userId, attended: value })

describe('buildRoster', () => {
  it('orders awaiting first, then available, then unavailable', () => {
    const members = [member('a', 'Ann'), member('b', 'Ben'), member('c', 'Cara')]
    const rows = buildRoster(members, [unavailable('a'), available('b')], [])
    expect(rows.map((r) => r.userId)).toEqual(['c', 'b', 'a'])
    expect(rows.map((r) => r.response)).toEqual([null, 'available', 'unavailable'])
  })

  it('breaks ties within a rank by name, case-insensitively and fada-insensitively', () => {
    const members = [
      member('1', 'sean'),
      member('2', 'Áine'),
      member('3', 'Aine'),
      member('4', 'Bláthnaid'),
    ]
    const rows = buildRoster(members, [], [])
    // 'Áine'/'Aine' collate as equal under sensitivity:'base', so the userId tie-break settles
    // their order ('2' before '3'); both sit ahead of 'Bláthnaid', then 'sean'.
    expect(rows.map((r) => r.name)).toEqual(['Áine', 'Aine', 'Bláthnaid', 'sean'])
  })

  it('breaks an exact name tie by userId ascending, stably across renders', () => {
    const members = [member('zzz', 'Sam'), member('aaa', 'Sam')]
    const first = buildRoster(members, [], [])
    const second = buildRoster([...members].reverse(), [], [])
    expect(first.map((r) => r.userId)).toEqual(['aaa', 'zzz'])
    expect(second.map((r) => r.userId)).toEqual(['aaa', 'zzz'])
  })

  it('drops a response whose user is not a current member (D22, D33)', () => {
    const rows = buildRoster([member('a', 'Ann')], [available('a'), available('leaver')], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.response).toBe('available')
  })

  it('drops an attendance row whose user is not a current member (D22, D33)', () => {
    const rows = buildRoster(
      [member('a', 'Ann')],
      [],
      [attended('a', true), attended('leaver', true)],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.attended).toBe(true)
  })

  it('returns [] for an empty squad', () => {
    expect(buildRoster([], [available('x')], [attended('x', true)])).toEqual([])
  })

  it('yields not-recorded and awaiting as null, and keeps a false attendance', () => {
    const rows = buildRoster(
      [member('a', 'Ann'), member('b', 'Ben')],
      [],
      [attended('a', true), attended('b', false)],
    )
    const ann = rows.find((r) => r.userId === 'a')
    const ben = rows.find((r) => r.userId === 'b')
    expect(ann).toMatchObject({ response: null, attended: true })
    expect(ben).toMatchObject({ response: null, attended: false })
  })

  it('does not mutate its inputs', () => {
    const members = [member('b', 'Ben'), member('a', 'Ann')]
    const responses = [available('a')]
    const attendance = [attended('a', true)]
    const membersCopy = [...members]
    buildRoster(members, responses, attendance)
    expect(members).toEqual(membersCopy)
    expect(members[0]?.userId).toBe('b')
  })

  it('agrees with deriveCounts on the same fixture: the card states sum to the counts', () => {
    const members = Array.from({ length: 8 }, (_, i) =>
      member(`u${String(i)}`, `Player ${String(i)}`),
    )
    const responses = [available('u0'), available('u1'), available('u2'), unavailable('u3')]
    const rows = buildRoster(members, responses, [])
    const counts = deriveCounts(
      members.map((m) => ({ userId: m.userId })),
      responses.map((r) => ({ userId: r.userId, response: r.response })),
    )
    expect(rows.filter((r) => r.response === 'available')).toHaveLength(counts.available)
    expect(rows.filter((r) => r.response === 'unavailable')).toHaveLength(counts.unavailable)
    expect(rows.filter((r) => r.response === null)).toHaveLength(counts.awaiting)
    expect(rows).toHaveLength(counts.squad)
  })
})
