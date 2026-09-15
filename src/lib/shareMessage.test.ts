import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOME_VENUE } from '@/lib/home-venue'
import { eventUrl } from '@/lib/paths'
import {
  buildMatchShareMessage,
  buildReminderMessage,
  buildShareMessage,
  EVENT_EMOJI,
  type MatchShareEvent,
  type MatchShareSquadMember,
  type ShareEvent,
  waMeUrl,
} from '@/lib/shareMessage'

// A concrete event id so eventUrl() is deterministic within a test. The base URL comes from the
// hermetic vitest env (VITE_APP_BASE_URL), so the last line is asserted through eventUrl(), never
// against a hardcoded origin — eventUrl()'s own trailing-slash cases belong to S0.3 AC9.
const ID = '9f1c0e2a-3b4d-4c5e-8f70-112233445566'

// Pin the clock to 2026 so formatEventTime appends no year to a 2026 event (D35). The real runner
// is already 2026, but this makes the byte-for-byte assertions independent of the wall clock.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

const match = (over: Partial<ShareEvent> = {}): ShareEvent => ({
  id: ID,
  type: 'match',
  title: 'Kilbarrack away',
  location: 'Fairview Park pitch 3',
  notes: null,
  starts_at: '2026-03-14T19:30:00Z', // GMT: 7.30pm Dublin
  ...over,
})

describe('buildShareMessage', () => {
  // AC8 / test-plan case 1 — D13's worked example, byte for byte. The URL line is built through
  // eventUrl(ID) because the base URL is environmental; every other byte is the literal from D13.
  it('reproduces D13 byte for byte', () => {
    expect(buildShareMessage(match())).toBe(
      [
        '⚽ Kilbarrack away',
        'Saturday 14 March, 7.30pm',
        'Fairview Park pitch 3',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  // AC1, AC2, AC5 — training, no notes: five lines, the running emoji, correct last line.
  it('renders a training with no notes as five lines', () => {
    const msg = buildShareMessage(
      match({ type: 'training', title: 'Training', location: 'Astro 2', notes: null }),
    )
    expect(msg).toBe(
      [
        '🏃 Training',
        'Saturday 14 March, 7.30pm',
        'Astro 2',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
    expect(msg.split('\n')).toHaveLength(5)
  })

  // AC2 — the two emoji, asserted as literals so a bad transcode fails the build.
  it('uses the fixed emoji per type and no other', () => {
    expect(EVENT_EMOJI.match).toBe('⚽')
    expect(EVENT_EMOJI.training).toBe('🏃')
    // Strip the single type badge, then assert nothing pictographic remains anywhere in the output.
    const leftover = buildShareMessage(match()).replace('⚽', '')
    expect(leftover).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  // AC3 — a GMT (January) and an IST (July) instant both render the correct Dublin wall clock.
  // Under TZ=UTC (D53) a naive formatter would render the July time an hour early; both read 7.30pm.
  it('renders both Dublin offsets correctly', () => {
    expect(buildShareMessage(match({ starts_at: '2026-01-17T19:30:00Z' }))).toContain(
      'Saturday 17 January, 7.30pm',
    )
    expect(buildShareMessage(match({ starts_at: '2026-07-18T18:30:00Z' }))).toContain(
      'Saturday 18 July, 7.30pm',
    )
  })

  // AC5, AC6 — notes present → six lines; null and whitespace-only → absent (five); newlines and
  // whitespace runs collapse to a single line so the count never varies with what was typed.
  it('handles the three notes cases', () => {
    expect(buildShareMessage(match({ notes: 'Bring both kits.' })).split('\n')).toHaveLength(6)
    expect(buildShareMessage(match({ notes: null })).split('\n')).toHaveLength(5)
    expect(buildShareMessage(match({ notes: '   ' })).split('\n')).toHaveLength(5)

    const collapsed = buildShareMessage(match({ notes: 'Bring both kits.\n\nPitch 3.' }))
    expect(collapsed.split('\n')).toHaveLength(6)
    expect(collapsed.split('\n')[3]).toBe('Bring both kits. Pitch 3.')
  })

  // AC7 — title and location are trimmed before interpolation.
  it('trims title and location', () => {
    const msg = buildShareMessage(
      match({ title: '  Kilbarrack away  ', location: '  Fairview Park pitch 3  ' }),
    )
    expect(msg.split('\n')[0]).toBe('⚽ Kilbarrack away')
    expect(msg.split('\n')[2]).toBe('Fairview Park pitch 3')
  })

  // S7.2 AC8 — an event 30 minutes into the spring-forward hour. Its Dublin wall clock is 2.30am
  // (the 01:00–02:00 IST hour does not exist), proving the generator reads Dublin local time and
  // not the UTC instant it was handed. Neither S5.1 nor S1.5 owns a share case that crosses DST.
  it('reads Dublin local time across the spring-forward boundary', () => {
    expect(buildShareMessage(match({ starts_at: '2026-03-29T01:30:00Z' }))).toContain(
      'Sunday 29 March, 2.30am',
    )
  })

  // Test-plan case 6 — a different calendar year reaches the message (the rule is formatEventTime's).
  it('carries the year for a non-current-year event', () => {
    expect(buildShareMessage(match({ starts_at: '2027-02-20T20:00:00Z' }))).toContain(
      'Saturday 20 February 2027, 8pm',
    )
  })

  // AC4 / test-plan case 7 — the last line is exactly what eventUrl(id) returns, not re-encoded.
  it('puts the exact eventUrl on the last line', () => {
    const lines = buildShareMessage(match()).split('\n')
    expect(lines[lines.length - 1]).toBe(`Are you available? ${eventUrl(ID)}`)
  })

  // AC11 — nothing addressed to an individual leaks in. Title is a person's name; assert no other
  // name, no phone number and no token appears.
  it('leaks no name, phone or token', () => {
    const msg = buildShareMessage(match({ title: 'Aoife Byrne', notes: null }))
    expect(msg).not.toMatch(/\+353/)
    expect(msg).not.toMatch(/\b08\d/)
    // The only proper name present is the title the manager chose.
    expect(msg).toBe(
      [
        '⚽ Aoife Byrne',
        'Saturday 14 March, 7.30pm',
        'Fairview Park pitch 3',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  // No trailing newline (D13): WhatsApp renders it as a stray empty line.
  it('has no trailing newline', () => {
    expect(buildShareMessage(match()).endsWith('\n')).toBe(false)
  })
})

describe('buildReminderMessage (S5.3)', () => {
  // AC1 / test-plan case 1 — D13's worked example, byte for byte. Same header as the share, a
  // different last line carrying the count. The URL line is built through eventUrl(ID).
  it('reproduces the D13 reminder byte for byte', () => {
    expect(buildReminderMessage(match({ notes: 'Bring both kits.' }), 8)).toBe(
      [
        '⚽ Kilbarrack away',
        'Saturday 14 March, 7.30pm',
        'Fairview Park pitch 3',
        'Bring both kits.',
        '',
        `8 still to answer. Yes or no: ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  // AC2 — the reminder differs from the initial share, and only in the final line. The header
  // block (every line up to and including the blank separator) is identical.
  it('shares the header with buildShareMessage and differs only on the last line', () => {
    const e = match({ notes: 'Bring both kits.' })
    const reminder = buildReminderMessage(e, 3).split('\n')
    const share = buildShareMessage(e).split('\n')
    expect(reminder).toHaveLength(share.length)
    expect(reminder.slice(0, -1)).toEqual(share.slice(0, -1))
    expect(reminder[reminder.length - 1]).not.toBe(share[share.length - 1])
    expect(buildReminderMessage(e, 3)).not.toBe(buildShareMessage(e))
  })

  // AC10 — one outstanding is "1 still to answer.", no pluralisation, no "1 player".
  it('does not special-case or pluralise a single outstanding', () => {
    const lines = buildReminderMessage(match(), 1).split('\n')
    expect(lines[lines.length - 1]).toBe(`1 still to answer. Yes or no: ${eventUrl(ID)}`)
  })

  // AC5 — anything but a positive integer throws, so the UI can never emit a nonsense count.
  it('throws a RangeError for a non-positive-integer count', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => buildReminderMessage(match(), bad)).toThrow(RangeError)
    }
  })

  // AC3 — the function takes a count, never a list, so it cannot name anyone. Even when the notes
  // a manager typed contain a player's name, nothing new is added: no phone, no token, no @-mention.
  it('names no player for any input', () => {
    const msg = buildReminderMessage(
      match({ title: 'Aoife Byrne', notes: 'Ask Cian about kit' }),
      5,
    )
    expect(msg).not.toMatch(/\+353/)
    expect(msg).not.toMatch(/\b08\d/)
    expect(msg).not.toContain('@')
    // The only names present are the title and notes the manager themselves chose.
    expect(msg).toBe(
      [
        '⚽ Aoife Byrne',
        'Saturday 14 March, 7.30pm',
        'Fairview Park pitch 3',
        'Ask Cian about kit',
        '',
        `5 still to answer. Yes or no: ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  // Test-plan case — the wa.me encoding of a reminder keeps the hash route, like the share variant.
  it('survives wa.me encoding with the hash route intact', () => {
    const url = waMeUrl(buildReminderMessage(match(), 8))
    expect(url).toContain('%23%2Fevent%2F')
    expect(url).not.toContain('#')
  })

  // No trailing newline (D13), matching the share variant.
  it('has no trailing newline', () => {
    expect(buildReminderMessage(match(), 8).endsWith('\n')).toBe(false)
  })
})

describe('buildMatchShareMessage (S9.3)', () => {
  // A home match kicking off 7.30pm Dublin, meeting 6.45pm. September is IST (+1), so the UTC
  // instants are 18:30 and 17:45. The `time` variant renders the Dublin wall clock (D35).
  const matchEvent = (over: Partial<MatchShareEvent> = {}): MatchShareEvent => ({
    id: ID,
    opponent: 'Kilbarrack',
    home_away: 'home',
    jersey: null,
    location: HOME_VENUE.mapsUrl,
    starts_at: '2026-09-12T18:30:00Z',
    meet_at: '2026-09-12T17:45:00Z',
    ...over,
  })

  // A full squad, deliberately out of shirt order on input so the sort is exercised.
  const SQUAD: MatchShareSquadMember[] = [
    { shirtNumber: 3, name: 'Cian Murphy', isCaptain: true },
    { shirtNumber: 1, name: 'John Smith', isCaptain: false },
    { shirtNumber: 10, name: 'Paul Byrne', isCaptain: false },
    { shirtNumber: 2, name: 'Liam Kelly', isCaptain: false },
  ]

  // AC1, AC5 — home + squad, byte for byte: "vs", KO+Meet, "Home Game: Bogies", blank, "Squad:",
  // right-aligned numbers, "(C)" on the captain, ordered by shirt number, then the availability link.
  it('renders a home match with a squad byte for byte', () => {
    expect(buildMatchShareMessage(matchEvent(), 'Firsts', SQUAD)).toBe(
      [
        'Firsts vs Kilbarrack',
        'KO: 19:30 | Meet: 18:45',
        'Home Game: Bogies',
        '',
        'Squad:',
        ' 1. John Smith',
        ' 2. Liam Kelly',
        ' 3. Cian Murphy (C)',
        '10. Paul Byrne',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  // AC2 — an away match: line three is "Away: {location}", the pasted maps link, not "Home Game".
  it('renders an away match with the location on line three', () => {
    const msg = buildMatchShareMessage(
      matchEvent({ home_away: 'away', location: 'https://maps.app.goo.gl/awayGround99' }),
      'Firsts',
      SQUAD,
    )
    expect(msg.split('\n')[0]).toBe('Firsts vs Kilbarrack')
    expect(msg.split('\n')[2]).toBe('Away: https://maps.app.goo.gl/awayGround99')
    expect(msg).not.toContain('Home Game')
  })

  // AC3 — no squad selected: no "Squad:" block, but the fixture still ends with the availability
  // link so the share is never a dead end (regression fix 2026-09-15).
  it('shares the fixture and the availability link when no squad is picked', () => {
    const msg = buildMatchShareMessage(matchEvent(), 'Firsts', [])
    expect(msg).toBe(
      [
        'Firsts vs Kilbarrack',
        'KO: 19:30 | Meet: 18:45',
        'Home Game: Bogies',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
    expect(msg).not.toContain('Squad:')
    expect(msg.endsWith('\n')).toBe(false)
  })

  // W7/S15.1 — the jersey line sits after the venue, before the squad, when set; omitted when null.
  it('adds a Jersey line after the venue when a kit is set, with a squad', () => {
    expect(buildMatchShareMessage(matchEvent({ jersey: 'sky' }), 'Firsts', SQUAD)).toBe(
      [
        'Firsts vs Kilbarrack',
        'KO: 19:30 | Meet: 18:45',
        'Home Game: Bogies',
        'Jersey: Light Blue',
        '',
        'Squad:',
        ' 1. John Smith',
        ' 2. Liam Kelly',
        ' 3. Cian Murphy (C)',
        '10. Paul Byrne',
        '',
        `Are you available? ${eventUrl(ID)}`,
      ].join('\n'),
    )
  })

  it('adds a Jersey line even without a squad, and omits it when no kit is set', () => {
    const withJersey = buildMatchShareMessage(matchEvent({ jersey: 'white' }), 'Firsts', [])
    expect(withJersey.split('\n')[3]).toBe('Jersey: White')
    const without = buildMatchShareMessage(matchEvent(), 'Firsts', [])
    expect(without).not.toContain('Jersey:')
  })

  // AC4 — meet_at null: the second line is just "KO: …" with no "| Meet:".
  it('omits the Meet clause when meet_at is null', () => {
    const msg = buildMatchShareMessage(matchEvent({ meet_at: null }), 'Firsts', SQUAD)
    expect(msg.split('\n')[1]).toBe('KO: 19:30')
    expect(msg).not.toContain('Meet:')
  })

  // AC6 — a summer (IST) and a winter (GMT) example both render the correct Dublin wall clock
  // under TZ=UTC. A naive formatter would render the summer time an hour early.
  it('renders both Dublin offsets correctly (DST)', () => {
    // Winter: 19:30 UTC in January is 7.30pm GMT.
    const winter = buildMatchShareMessage(
      matchEvent({ starts_at: '2026-01-17T19:30:00Z', meet_at: '2026-01-17T18:45:00Z' }),
      'Firsts',
      [],
    )
    expect(winter.split('\n')[1]).toBe('KO: 19:30 | Meet: 18:45')
    // Summer: 18:30 UTC in July is 7.30pm IST (+1).
    const summer = buildMatchShareMessage(
      matchEvent({ starts_at: '2026-07-18T18:30:00Z', meet_at: '2026-07-18T17:45:00Z' }),
      'Firsts',
      [],
    )
    expect(summer.split('\n')[1]).toBe('KO: 19:30 | Meet: 18:45')
  })

  // The home label comes from the one HOME_VENUE constant, and team/opponent are trimmed.
  it('labels home from HOME_VENUE and trims team and opponent', () => {
    const msg = buildMatchShareMessage(matchEvent({ opponent: '  Kilbarrack  ' }), '  Firsts  ', [])
    expect(msg.split('\n')[0]).toBe('Firsts vs Kilbarrack')
    expect(msg.split('\n')[2]).toBe('Home Game: Bogies')
  })

  // The match teamsheet now ends with the availability link, whether or not a squad is picked, so a
  // player tapping it from WhatsApp can register or set availability (regression fix 2026-09-15).
  it('ends with the exact eventUrl on its last line, with and without a squad', () => {
    for (const squad of [SQUAD, []] as const) {
      const lines = buildMatchShareMessage(matchEvent(), 'Firsts', squad).split('\n')
      expect(lines[lines.length - 1]).toBe(`Are you available? ${eventUrl(ID)}`)
      // The link sits on its own line after a blank separator, mirroring the availability share.
      expect(lines[lines.length - 2]).toBe('')
    }
  })
})

describe('waMeUrl', () => {
  // AC9 / test-plan case 8 — percent-encoded (D52): contains %23%2Fevent%2F, no raw #, and
  // round-trips back to the exact message.
  it('percent-encodes the body and round-trips', () => {
    const message = buildShareMessage(match())
    const url = waMeUrl(message)
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`)
    expect(url).toContain('%23%2Fevent%2F')
    expect(url).not.toContain('#')
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(url).not.toContain('&phone=')
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(message)
  })

  // Spaces are encoded as %20, never '+', so WhatsApp does not render literal plus signs (D52).
  it('encodes spaces as %20, not +', () => {
    const url = waMeUrl(buildShareMessage(match()))
    expect(url).toContain('%20')
    expect(url).not.toContain('+')
  })

  // S7.2 AC7 — every newline in the body survives as %0A, and the whole body round-trips through
  // the URL's own parser back to the exact input, which is the assertion that would catch a silent
  // truncation at the '#' (D52).
  it('encodes each newline as %0A and round-trips via URL.searchParams', () => {
    const message = buildShareMessage(match({ notes: 'Bring both kits.' }))
    const url = waMeUrl(message)
    const newlines = (message.match(/\n/g) ?? []).length
    expect(newlines).toBeGreaterThan(0)
    expect((url.match(/%0A/g) ?? []).length).toBe(newlines)
    expect(decodeURIComponent(new URL(url).searchParams.get('text') ?? '')).toBe(message)
  })
})
