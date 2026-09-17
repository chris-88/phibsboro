import { describe, expect, it } from 'vitest'
import { buildSubsRows, formatMoney, mySubs, summariseSubs } from '@/features/subs/subs'

const members = [
  { userId: 'a', name: 'Aaron' },
  { userId: 'b', name: 'Ben' },
  { userId: 'c', name: 'Ciaran' },
]

describe('buildSubsRows (Epic 19)', () => {
  it('sums part-payments and derives outstanding, clamped at zero', () => {
    const rows = buildSubsRows(
      members,
      [
        { user_id: 'a', amount: 40 },
        { user_id: 'a', amount: 30 },
        { user_id: 'b', amount: 120 }, // overpaid
      ],
      100,
    )
    const byId = new Map(rows.map((r) => [r.userId, r]))
    expect(byId.get('a')).toMatchObject({ paid: 70, outstanding: 30, amountDue: 100 })
    expect(byId.get('b')).toMatchObject({ paid: 120, outstanding: 0 }) // never negative
    expect(byId.get('c')).toMatchObject({ paid: 0, outstanding: 100 })
  })

  it('orders most-owing first, then by name', () => {
    const rows = buildSubsRows(
      members,
      [
        { user_id: 'a', amount: 100 }, // paid up
        { user_id: 'b', amount: 0.0 }, // owes 100
      ],
      100,
    )
    // Ben and Ciaran both owe 100 → by name; Aaron (paid up) last.
    expect(rows.map((r) => r.userId)).toEqual(['b', 'c', 'a'])
  })
})

describe('summariseSubs', () => {
  it('totals due, paid, outstanding and the paid-up count', () => {
    const rows = buildSubsRows(members, [{ user_id: 'a', amount: 100 }], 100)
    expect(summariseSubs(rows)).toEqual({
      members: 3,
      paidUp: 1,
      totalDue: 300,
      totalPaid: 100,
      totalOutstanding: 200,
    })
  })
})

describe('mySubs', () => {
  it('sums the caller’s own payments against the amount', () => {
    expect(mySubs([{ amount: 20 }, { amount: 15 }], 100)).toEqual({
      amountDue: 100,
      paid: 35,
      outstanding: 65,
    })
    expect(mySubs([], 100)).toEqual({ amountDue: 100, paid: 0, outstanding: 100 })
    expect(mySubs([{ amount: 200 }], 100)).toEqual({ amountDue: 100, paid: 200, outstanding: 0 })
  })
})

describe('formatMoney', () => {
  it('renders euro to two places', () => {
    expect(formatMoney(100)).toBe('€100.00')
    expect(formatMoney(7.5)).toBe('€7.50')
    expect(formatMoney(0)).toBe('€0.00')
  })
})
