import { describe, expect, it } from 'vitest'
import { trainingSeriesSchema } from '@/features/events/schema'

const NOW = new Date('2026-03-14T12:00:00Z')
const schema = trainingSeriesSchema({ now: NOW })
const base = {
  teamId: '00000000-0000-4000-8000-000000000001',
  firstStartsAt: '2026-04-01T18:30:00.000Z',
  title: 'Tuesday training',
  location: 'Dalymount Park',
}

describe('trainingSeriesSchema', () => {
  it('accepts a 16-week future run', () => {
    expect(schema.safeParse({ ...base, weeks: 16 }).success).toBe(true)
  })

  it('rejects weeks above 16 on the weeks path', () => {
    const r = schema.safeParse({ ...base, weeks: 17 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['weeks'])
  })

  it('rejects a non-integer horizon on the weeks path', () => {
    const r = schema.safeParse({ ...base, weeks: 1.5 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['weeks'])
  })

  it('rejects weeks below 1 on the weeks path', () => {
    const r = schema.safeParse({ ...base, weeks: 0 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['weeks'])
  })

  it('rejects a first session at or before the injected now on the firstStartsAt path', () => {
    const r = schema.safeParse({ ...base, firstStartsAt: '2026-03-01T18:30:00.000Z', weeks: 4 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'firstStartsAt')).toBe(true)
  })
})
