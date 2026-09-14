import { describe, expect, it } from 'vitest'
import {
  buildPickerModel,
  freeNumbers,
  MAX_SQUAD,
  squadStatusText,
  type PickerMember,
  type PickerPick,
  type PickerResponse,
} from '@/features/events/squad-picker'

const members: PickerMember[] = [
  { userId: 'a', name: 'Aaron' },
  { userId: 'b', name: 'Ben' },
  { userId: 'c', name: 'Cian' },
  { userId: 'd', name: 'Dara' },
]

describe('freeNumbers (S9.2)', () => {
  it('lists 1–20 ascending when nothing is taken', () => {
    expect(freeNumbers(new Set())).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })
  it('drops the taken numbers', () => {
    expect(freeNumbers(new Set([1, 7, 20]))).not.toContain(7)
    expect(freeNumbers(new Set([1, 7, 20]))[0]).toBe(2)
  })
})

describe('buildPickerModel (S9.2)', () => {
  it('pools only available responders, not awaiting or unavailable', () => {
    const responses: PickerResponse[] = [
      { userId: 'a', response: 'available' },
      { userId: 'b', response: 'unavailable' },
      // c is awaiting (no row); d is available
      { userId: 'd', response: 'available' },
    ]
    const model = buildPickerModel(members, responses, [])
    const poolIds = model.available.map((e) => e.userId)
    expect(poolIds).toEqual(['a', 'd'])
    expect(poolIds).not.toContain('b')
    expect(poolIds).not.toContain('c')
  })

  it('sorts picked by shirt number and the pool by name', () => {
    const responses: PickerResponse[] = members.map((m) => ({
      userId: m.userId,
      response: 'available',
    }))
    const picks: PickerPick[] = [
      { userId: 'd', shirtNumber: 7, isCaptain: false },
      { userId: 'a', shirtNumber: 1, isCaptain: true },
    ]
    const model = buildPickerModel(members, responses, picks)
    expect(model.picked.map((e) => e.shirtNumber)).toEqual([1, 7])
    expect(model.available.map((e) => e.name)).toEqual(['Ben', 'Cian'])
    expect(model.count).toBe(2)
    expect(model.captainUserId).toBe('a')
  })

  it('offers each number once: taken numbers are excluded from the free set', () => {
    const responses: PickerResponse[] = members.map((m) => ({
      userId: m.userId,
      response: 'available',
    }))
    const picks: PickerPick[] = [{ userId: 'a', shirtNumber: 1, isCaptain: false }]
    const model = buildPickerModel(members, responses, picks)
    expect(model.takenNumbers.has(1)).toBe(true)
    expect(model.nextFreeNumber).toBe(2)
  })

  it('flags a picked player who is no longer available but keeps them removable', () => {
    const responses: PickerResponse[] = [{ userId: 'b', response: 'available' }]
    // a was picked but has since gone unavailable (no available row)
    const picks: PickerPick[] = [{ userId: 'a', shirtNumber: 4, isCaptain: false }]
    const model = buildPickerModel(members, responses, picks)
    const aaron = model.picked.find((e) => e.userId === 'a')
    expect(aaron?.unavailableFlag).toBe(true)
    expect(aaron?.available).toBe(false)
    // and the pool never offers the flagged player
    expect(model.available.map((e) => e.userId)).not.toContain('a')
  })

  it('caps at 20: atCapacity once the squad is full and no next free number', () => {
    const many: PickerMember[] = Array.from({ length: 21 }, (_, i) => ({
      userId: `u${String(i)}`,
      name: `Player ${String(i)}`,
    }))
    const responses: PickerResponse[] = many.map((m) => ({
      userId: m.userId,
      response: 'available',
    }))
    const picks: PickerPick[] = Array.from({ length: MAX_SQUAD }, (_, i) => ({
      userId: `u${String(i)}`,
      shirtNumber: i + 1,
      isCaptain: false,
    }))
    const model = buildPickerModel(many, responses, picks)
    expect(model.count).toBe(20)
    expect(model.atCapacity).toBe(true)
    expect(model.nextFreeNumber).toBeNull()
  })
})

describe('squadStatusText (S9.2)', () => {
  it('reads "Squad not picked" when empty', () => {
    expect(squadStatusText(0, false)).toBe('Squad not picked')
  })
  it('counts the picked and notes a captain', () => {
    expect(squadStatusText(18, false)).toBe('18 picked')
    expect(squadStatusText(18, true)).toBe('18 picked · captain named')
  })
})
