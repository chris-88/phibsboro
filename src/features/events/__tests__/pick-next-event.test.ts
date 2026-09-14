import { describe, expect, it } from 'vitest'
import type { UpcomingEvent } from '@/api/events'
import { pickNextEvent } from '@/features/events/pick-next-event'

const ev = (over: Partial<UpcomingEvent>): UpcomingEvent => ({
  id: 'e1',
  teamId: 't1',
  teamName: 'Firsts',
  type: 'training',
  title: 'Training',
  location: 'Dalymount Park',
  startsAt: '2026-09-15T18:00:00.000+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

describe('pickNextEvent (S3.1)', () => {
  it('returns the first scheduled row of an already-ordered list (AC1)', () => {
    const list = [
      ev({ id: 'a', startsAt: '2026-09-15T18:00:00.000+00:00' }),
      ev({ id: 'b', startsAt: '2026-09-16T18:00:00.000+00:00' }),
    ]
    expect(pickNextEvent(list)?.id).toBe('a')
  })

  it('skips a cancelled row that sorts first and returns the next scheduled one (AC4)', () => {
    const list = [
      ev({ id: 'cancelled', status: 'cancelled', startsAt: '2026-09-15T18:00:00.000+00:00' }),
      ev({ id: 'scheduled', status: 'scheduled', startsAt: '2026-09-16T18:00:00.000+00:00' }),
    ]
    expect(pickNextEvent(list)?.id).toBe('scheduled')
  })

  it('returns null when every row is cancelled (AC4)', () => {
    const list = [ev({ id: 'a', status: 'cancelled' }), ev({ id: 'b', status: 'cancelled' })]
    expect(pickNextEvent(list)).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(pickNextEvent([])).toBeNull()
  })
})
