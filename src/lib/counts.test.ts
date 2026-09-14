import { describe, expect, it } from 'vitest'
import { deriveCounts, type ResponseRow, type SquadMember } from '@/lib/counts'

const member = (id: string): SquadMember => ({ userId: id })
const available = (id: string): ResponseRow => ({ userId: id, response: 'available' })
const unavailable = (id: string): ResponseRow => ({ userId: id, response: 'unavailable' })

/** The invariant D22 hangs on: the four counts always sum to the squad size. Asserted, not eyeballed. */
function expectSums(counts: ReturnType<typeof deriveCounts>): void {
  expect(counts.available + counts.unavailable + counts.awaiting).toBe(counts.squad)
}

describe('deriveCounts', () => {
  it('an empty squad is four zeros, and still sums', () => {
    const counts = deriveCounts([], [])
    expect(counts).toEqual({ available: 0, unavailable: 0, awaiting: 0, squad: 0 })
    expectSums(counts)
  })

  it('a squad of twenty with no responses is all awaiting', () => {
    const squad = Array.from({ length: 20 }, (_, i) => member(`u${String(i)}`))
    const counts = deriveCounts(squad, [])
    expect(counts).toEqual({ available: 0, unavailable: 0, awaiting: 20, squad: 20 })
    expectSums(counts)
  })

  it('everybody available leaves nobody awaiting', () => {
    const squad = [member('a'), member('b'), member('c')]
    const counts = deriveCounts(squad, [available('a'), available('b'), available('c')])
    expect(counts).toEqual({ available: 3, unavailable: 0, awaiting: 0, squad: 3 })
    expectSums(counts)
  })

  it('a mix of answered and unanswered members', () => {
    const squad = [member('a'), member('b'), member('c'), member('d'), member('e')]
    const counts = deriveCounts(squad, [available('a'), available('b'), unavailable('c')])
    expect(counts).toEqual({ available: 2, unavailable: 1, awaiting: 2, squad: 5 })
    expectSums(counts)
  })

  it('ignores a response from a user who is no longer a member (D22, D33) — the count that matters', () => {
    // 'ghost' left the team but their historic response row still comes back to the manager.
    const squad = [member('a'), member('b')]
    const counts = deriveCounts(squad, [available('a'), available('ghost'), unavailable('gone')])
    expect(counts).toEqual({ available: 1, unavailable: 0, awaiting: 1, squad: 2 })
    // The leaver does not inflate available and does not change squad.
    expectSums(counts)
  })

  it('a member with no response is counted as awaiting', () => {
    const squad = [member('a'), member('b')]
    const counts = deriveCounts(squad, [available('a')])
    expect(counts.awaiting).toBe(1)
    expectSums(counts)
  })

  it('every response orphaned by an empty squad moves no number (S7.2 AC5, D22)', () => {
    // Not one member, yet a leaver's row still comes back: it is excluded from all four numbers.
    const counts = deriveCounts([], [available('z')])
    expect(counts).toEqual({ available: 0, unavailable: 0, awaiting: 0, squad: 0 })
    expectSums(counts)
  })

  it('a member with two response rows does not throw and still sums (S7.2 AC5)', () => {
    // The (event_id, user_id) primary key makes this impossible through the wire, but the pure
    // function must not throw if handed it. deriveCounts counts every matching row rather than
    // de-duplicating, so the sum invariant holds by construction and awaiting absorbs the double
    // count — never a crash.
    const counts = deriveCounts([member('a')], [available('a'), unavailable('a')])
    expect(() => deriveCounts([member('a')], [available('a'), unavailable('a')])).not.toThrow()
    expect(counts.squad).toBe(1)
    expectSums(counts)
  })

  it('matches the seeded event 102: squad 12, one leaver response among ten rows', () => {
    // The real seed row this screen was verified against: 10 response rows, one from a leaver,
    // 6 member-available and 3 member-unavailable → awaiting 3 (D22/D33). See the build report.
    const squad = Array.from({ length: 12 }, (_, i) => member(`m${String(i)}`))
    const responses: ResponseRow[] = [
      ...Array.from({ length: 6 }, (_, i) => available(`m${String(i)}`)),
      ...Array.from({ length: 3 }, (_, i) => unavailable(`m${String(i + 6)}`)),
      available('leaver'),
    ]
    const counts = deriveCounts(squad, responses)
    expect(counts).toEqual({ available: 6, unavailable: 3, awaiting: 3, squad: 12 })
    expectSums(counts)
  })
})
