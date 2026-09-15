import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TITLES,
  eventFormSchema,
  eventTypeSchema,
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
    opponent: '',
    homeAway: 'home',
    jersey: null,
    meetTime: '',
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

describe('eventTypeSchema (S8.1 AC3)', () => {
  it('accepts training, match and social', () => {
    expect(eventTypeSchema.safeParse('training').success).toBe(true)
    expect(eventTypeSchema.safeParse('match').success).toBe(true)
    expect(eventTypeSchema.safeParse('social').success).toBe(true)
  })

  it('rejects an unknown type', () => {
    expect(eventTypeSchema.safeParse('friendly').success).toBe(false)
  })
})

describe('shouldRewriteTitle (AC2)', () => {
  it('rewrites an empty title', () => {
    expect(shouldRewriteTitle('', 'match')).toBe(true)
    expect(shouldRewriteTitle('   ', 'match')).toBe(true)
  })

  it('rewrites another type default label', () => {
    // Switching to match while the title is still "Training".
    expect(shouldRewriteTitle('Training', 'match')).toBe(true)
    expect(shouldRewriteTitle('Match', 'training')).toBe(true)
    // Social is a third default, rewritten the same way (S8.1).
    expect(shouldRewriteTitle('Social', 'match')).toBe(true)
    expect(shouldRewriteTitle('Training', 'social')).toBe(true)
    expect(shouldRewriteTitle('Match', 'social')).toBe(true)
  })

  it('keeps a title the manager typed', () => {
    expect(shouldRewriteTitle('Kilbarrack away', 'match')).toBe(false)
    expect(shouldRewriteTitle('Kilbarrack away', 'training')).toBe(false)
    expect(shouldRewriteTitle('End of season party', 'social')).toBe(false)
  })

  it('keeps the matching default (no needless rewrite when already correct)', () => {
    // Title "Match" while switching to match is the same-type default, not another type's.
    expect(shouldRewriteTitle('Match', 'match')).toBe(false)
    expect(shouldRewriteTitle('Training', 'training')).toBe(false)
    expect(shouldRewriteTitle('Social', 'social')).toBe(false)
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
  it('defaults training to Training, match to Match, social to Social', () => {
    expect(DEFAULT_TITLES.training).toBe('Training')
    expect(DEFAULT_TITLES.match).toBe('Match')
    expect(DEFAULT_TITLES.social).toBe('Social')
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
      goodValues({
        title: '  Firsts v Kilbarrack  ',
        location: '  Tolka Park  ',
        type: 'match',
        opponent: '  Kilbarrack  ',
        homeAway: 'home',
        jersey: 'sky',
      }),
    )
    expect(row).toEqual({
      type: 'match',
      title: 'Firsts v Kilbarrack',
      location: 'Tolka Park',
      notes: null,
      opponent: 'Kilbarrack',
      home_away: 'home',
      jersey: 'sky',
      meet_at: null,
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

describe('match opponent + home/away (S8.2)', () => {
  const schema = eventFormSchema({ requireFuture: true, now: NOW })
  const messageFor = (values: EventFormValues, path: string): string | undefined => {
    const result = schema.safeParse(values)
    if (result.success) return undefined
    return result.error.issues.find((i) => i.path.join('.') === path)?.message
  }

  it('accepts a match with an opponent and a side', () => {
    const values = goodValues({
      type: 'match',
      opponent: 'Kilbarrack',
      homeAway: 'home',
      jersey: null,
      title: 'Firsts v Kilbarrack',
    })
    expect(schema.safeParse(values).success).toBe(true)
  })

  it('rejects a match with no opponent (AC3)', () => {
    const values = goodValues({ type: 'match', opponent: '   ', title: 'Firsts v' })
    expect(messageFor(values, 'opponent')).toBe('Enter the opponent.')
  })

  it('rejects a non-match that still carries an opponent — forbidden otherwise (AC3)', () => {
    const values = goodValues({ type: 'training', opponent: 'Kilbarrack' })
    expect(messageFor(values, 'opponent')).toBe('Opponent is only for matches.')
  })

  it('rejects a generated match title over 80 characters through the title bound', () => {
    const values = goodValues({
      type: 'match',
      opponent: 'x'.repeat(50),
      title: 'Firsts v ' + 'x'.repeat(80),
    })
    expect(schema.safeParse(values).success).toBe(false)
  })

  it('nulls opponent and home_away off a non-match on insert and update', () => {
    const training = goodValues({ type: 'training', opponent: '', homeAway: 'home' })
    const inserted = toEventInsert(training, 'creator-uuid')
    expect(inserted.opponent).toBeNull()
    expect(inserted.home_away).toBeNull()
    const updated = toEventUpdate(training)
    expect(updated.opponent).toBeNull()
    expect(updated.home_away).toBeNull()
  })

  it('stores opponent and home_away on a match insert', () => {
    const match = goodValues({
      type: 'match',
      opponent: '  Kilbarrack  ',
      homeAway: 'away',
      jersey: null,
      title: 'Kilbarrack v Firsts',
    })
    const inserted = toEventInsert(match, 'creator-uuid')
    expect(inserted.opponent).toBe('Kilbarrack')
    expect(inserted.home_away).toBe('away')
  })
})

describe('match meet + kick-off (S8.3)', () => {
  const schema = eventFormSchema({ requireFuture: true, now: NOW })
  const messageFor = (values: EventFormValues, path: string): string | undefined => {
    const result = schema.safeParse(values)
    if (result.success) return undefined
    return result.error.issues.find((i) => i.path.join('.') === path)?.message
  }

  const match = (overrides: Partial<EventFormValues> = {}): EventFormValues =>
    goodValues({
      type: 'match',
      opponent: 'Kilbarrack',
      homeAway: 'home',
      jersey: null,
      title: 'Firsts v Kilbarrack',
      date: '2026-07-18',
      time: '13:30',
      ...overrides,
    })

  it('accepts a match whose meet is before kick-off (AC2, AC3)', () => {
    expect(schema.safeParse(match({ meetTime: '12:30' })).success).toBe(true)
  })

  it('accepts a match with no meet time — it is optional', () => {
    expect(schema.safeParse(match({ meetTime: '' })).success).toBe(true)
  })

  it('rejects a meet equal to kick-off (AC3)', () => {
    expect(messageFor(match({ meetTime: '13:30' }), 'meetTime')).toBe(
      'Meet must be before kick-off.',
    )
  })

  it('rejects a meet after kick-off (AC3)', () => {
    expect(messageFor(match({ meetTime: '14:00' }), 'meetTime')).toBe(
      'Meet must be before kick-off.',
    )
  })

  it('composes meet_at as the Dublin wall clock in UTC at a summer (DST) boundary (AC2)', () => {
    // 18 July is IST (UTC+1): 12:30 Dublin → 11:30Z, 13:30 Dublin → 12:30Z.
    const inserted = toEventInsert(match({ meetTime: '12:30' }), 'creator-uuid')
    expect(inserted.meet_at).toBe('2026-07-18T11:30:00.000Z')
    expect(inserted.starts_at).toBe('2026-07-18T12:30:00.000Z')
  })

  it('composes meet_at in UTC at a winter (GMT) boundary (AC2)', () => {
    // 17 January is GMT (UTC+0): the wall clock and UTC agree.
    const inserted = toEventInsert(
      match({ date: '2027-01-17', time: '15:00', meetTime: '14:00' }),
      'creator-uuid',
    )
    expect(inserted.meet_at).toBe('2027-01-17T14:00:00.000Z')
    expect(inserted.starts_at).toBe('2027-01-17T15:00:00.000Z')
  })

  it('nulls meet_at off a non-match, even if a stray value lingers, on insert and update', () => {
    const training = goodValues({ type: 'training', meetTime: '12:30' })
    expect(toEventInsert(training, 'creator-uuid').meet_at).toBeNull()
    expect(toEventUpdate(training).meet_at).toBeNull()
  })

  it('stores meet_at on a match update', () => {
    expect(toEventUpdate(match({ meetTime: '12:30' })).meet_at).toBe('2026-07-18T11:30:00.000Z')
  })
})
