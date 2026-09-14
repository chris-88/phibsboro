import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TITLES,
  eventFormSchema,
  shouldRewriteTitle,
  toEventInsert,
  toEventUpdate,
  type EventFormValues,
} from '@/features/events/schema'

// A fixed instant, so the horizon and future-only rules never read the wall clock (D48).
const NOW = new Date('2026-03-14T12:00:00Z')

/** A payload that should pass: a training four hours after NOW, in Dublin wall clock. */
function goodValues(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    teamId: '11111111-1111-1111-1111-111111111111',
    type: 'training',
    title: 'Training',
    date: '2026-03-14',
    time: '19:30',
    location: 'Dalymount Park',
    notes: '',
    ...overrides,
  }
}

describe('eventFormSchema — happy path', () => {
  it('accepts a well-formed future event', () => {
    const schema = eventFormSchema({ requireFuture: true, now: NOW })
    expect(schema.safeParse(goodValues()).success).toBe(true)
  })
})

describe('eventFormSchema — field validation (AC5)', () => {
  const schema = eventFormSchema({ requireFuture: true, now: NOW })
  const messageFor = (values: EventFormValues, path: string): string | undefined => {
    const result = schema.safeParse(values)
    if (result.success) return undefined
    return result.error.issues.find((i) => i.path.join('.') === path)?.message
  }

  it('rejects an empty title', () => {
    expect(schema.safeParse(goodValues({ title: '   ' })).success).toBe(false)
  })

  it('rejects a title over 80 characters', () => {
    expect(schema.safeParse(goodValues({ title: 'a'.repeat(81) })).success).toBe(false)
  })

  it('rejects an empty location', () => {
    expect(schema.safeParse(goodValues({ location: '' })).success).toBe(false)
  })

  it('rejects a location over 120 characters', () => {
    expect(schema.safeParse(goodValues({ location: 'a'.repeat(121) })).success).toBe(false)
  })

  it('rejects notes over 500 characters with its own message', () => {
    expect(messageFor(goodValues({ notes: 'a'.repeat(501) }), 'notes')).toBe(
      'Keep notes under 500 characters.',
    )
  })

  it('rejects a missing date and a missing time', () => {
    expect(messageFor(goodValues({ date: '' }), 'date')).toBe('Pick a date.')
    expect(messageFor(goodValues({ time: '' }), 'time')).toBe('Pick a start time.')
  })
})

describe('eventFormSchema — the future and horizon rules (AC6)', () => {
  const schema = eventFormSchema({ requireFuture: true, now: NOW })
  const messageFor = (values: EventFormValues, path: string): string | undefined => {
    const result = schema.safeParse(values)
    if (result.success) return undefined
    return result.error.issues.find((i) => i.path.join('.') === path)?.message
  }

  it('rejects a start at or before now with a future message on the time field', () => {
    // NOW is 12:00Z on 14 March (GMT); 12:00 Dublin is 12:00Z, exactly now → rejected.
    expect(messageFor(goodValues({ date: '2026-03-14', time: '12:00' }), 'time')).toBe(
      'Pick a time in the future.',
    )
    // A minute earlier is also rejected.
    expect(messageFor(goodValues({ date: '2026-03-14', time: '11:59' }), 'time')).toBe(
      'Pick a time in the future.',
    )
  })

  it('rejects a start more than a year ahead with a horizon message on the date field', () => {
    expect(messageFor(goodValues({ date: '2027-03-15', time: '19:30' }), 'date')).toBe(
      "That's more than a year away.",
    )
  })

  it('accepts a start just inside a year', () => {
    expect(schema.safeParse(goodValues({ date: '2027-03-13', time: '12:00' })).success).toBe(true)
  })

  it('with requireFuture off, a past start is accepted (S4.2 edit path)', () => {
    const editSchema = eventFormSchema({ requireFuture: false, now: NOW })
    expect(editSchema.safeParse(goodValues({ date: '2026-03-13', time: '19:30' })).success).toBe(
      true,
    )
  })
})

describe('shouldRewriteTitle (AC2)', () => {
  it('rewrites an empty title', () => {
    expect(shouldRewriteTitle('', 'match')).toBe(true)
    expect(shouldRewriteTitle('   ', 'match')).toBe(true)
  })

  it('rewrites the other type default label', () => {
    // Switching to match while the title is still "Training".
    expect(shouldRewriteTitle('Training', 'match')).toBe(true)
    expect(shouldRewriteTitle('Match', 'training')).toBe(true)
  })

  it('keeps a title the manager typed', () => {
    expect(shouldRewriteTitle('Kilbarrack away', 'match')).toBe(false)
    expect(shouldRewriteTitle('Kilbarrack away', 'training')).toBe(false)
  })

  it('keeps the matching default (no needless rewrite when already correct)', () => {
    // Title "Match" while switching to match is the same-type default, not the other type's.
    expect(shouldRewriteTitle('Match', 'match')).toBe(false)
    expect(shouldRewriteTitle('Training', 'training')).toBe(false)
  })
})

describe('toEventInsert (AC3, AC7)', () => {
  it('maps blank notes to null, never an empty string', () => {
    const row = toEventInsert(goodValues({ notes: '   ' }), 'creator-uuid')
    expect(row.notes).toBeNull()
  })

  it('keeps trimmed notes', () => {
    const row = toEventInsert(goodValues({ notes: '  bring bibs  ' }), 'creator-uuid')
    expect(row.notes).toBe('bring bibs')
  })

  it('composes starts_at as the Dublin wall clock in UTC', () => {
    const row = toEventInsert(goodValues({ date: '2026-07-14', time: '19:30' }), 'creator-uuid')
    expect(row.starts_at).toBe('2026-07-14T18:30:00.000Z')
  })

  it('carries team_id, type, trimmed title and location, and created_by', () => {
    const row = toEventInsert(
      goodValues({ title: '  Cup final  ', location: '  Tolka Park  ', type: 'match' }),
      'creator-uuid',
    )
    expect(row).toMatchObject({
      team_id: '11111111-1111-1111-1111-111111111111',
      type: 'match',
      title: 'Cup final',
      location: 'Tolka Park',
      created_by: 'creator-uuid',
    })
  })
})

describe('DEFAULT_TITLES', () => {
  it('defaults training to Training and match to Match', () => {
    expect(DEFAULT_TITLES.training).toBe('Training')
    expect(DEFAULT_TITLES.match).toBe('Match')
  })
})

describe('eventFormSchema — the edit flag (S4.2 AC5)', () => {
  // A past instant, four hours before NOW, so the future-only rule is the only thing that could
  // reject it.
  const past = (overrides: Partial<EventFormValues> = {}): EventFormValues =>
    goodValues({ date: '2026-03-14', time: '08:00', ...overrides })

  it('requireFuture false accepts a past instant — last night is editable', () => {
    const schema = eventFormSchema({ requireFuture: false, now: NOW })
    expect(schema.safeParse(past()).success).toBe(true)
  })

  it('requireFuture true rejects the same past instant', () => {
    const schema = eventFormSchema({ requireFuture: true, now: NOW })
    const result = schema.safeParse(past())
    expect(result.success).toBe(false)
  })

  it('the length and 365-day rules stay on even when requireFuture is false', () => {
    const schema = eventFormSchema({ requireFuture: false, now: NOW })
    expect(schema.safeParse(past({ title: 'x'.repeat(81) })).success).toBe(false)
    expect(schema.safeParse(past({ date: '2028-01-01', time: '19:30' })).success).toBe(false)
  })
})

describe('toEventUpdate (S4.2)', () => {
  it('carries only the six editable columns, no team_id/created_by/series_id/status', () => {
    const row = toEventUpdate(
      goodValues({ title: '  Cup final  ', location: '  Tolka Park  ', type: 'match' }),
    )
    expect(row).toEqual({
      type: 'match',
      title: 'Cup final',
      location: 'Tolka Park',
      notes: null,
      starts_at: '2026-03-14T19:30:00.000Z',
    })
    expect(row).not.toHaveProperty('team_id')
    expect(row).not.toHaveProperty('created_by')
    expect(row).not.toHaveProperty('series_id')
    expect(row).not.toHaveProperty('status')
  })

  it('blank notes become null, not an empty string (AC7)', () => {
    expect(toEventUpdate(goodValues({ notes: '   ' })).notes).toBeNull()
  })
})
