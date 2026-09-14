import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventUrl } from '@/lib/paths'
import {
  buildReminderMessage,
  buildShareMessage,
  EVENT_EMOJI,
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
})
