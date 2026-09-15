/**
 * The one place the WhatsApp share text is built. The format is fixed literally by D13 and
 * asserted byte for byte in Vitest, so a wording change is a deliberate edit to a test, not a
 * drift. Pure: no `Date.now()`, no `navigator`, no `window`, no network, no React. The date line
 * comes from `formatEventTime` (D35) and the link from `eventUrl` (S0.3) — this module contains
 * no hash-route literal, does no date formatting, and never reads `import.meta.env`.
 */
import type { Tables } from '@/lib/db'
import { HOME_VENUE } from '@/lib/home-venue'
import { eventUrl } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

type EventRow = Tables<'events'>

/** The only fields the share text needs. Deliberately narrower than the row. */
export type ShareEvent = Pick<
  EventRow,
  'id' | 'type' | 'title' | 'location' | 'notes' | 'starts_at'
>

/** Exhaustive by construction: `type` is the `event_type` enum, so no default branch is needed
 *  and adding a value in SQL breaks typecheck here (D13, D24). */
export const EVENT_EMOJI: Record<EventRow['type'], string> = {
  match: '⚽',
  training: '🏃',
  social: '🎉',
}

/** Trim, collapse every run of whitespace (including the newlines a textarea allows) to a single
 *  space, and treat a whitespace-only note as absent — so the message is always five or six lines
 *  whatever a manager typed (AC6). */
function normaliseNotes(notes: string | null): string | null {
  if (notes === null) return null
  const collapsed = notes.replace(/\s+/g, ' ').trim()
  return collapsed === '' ? null : collapsed
}

/** The shared first block: emoji + title, date line, location, optional notes, then the blank
 *  separator line. S5.3's reminder reuses this and swaps only the last line. */
function eventHeader(event: ShareEvent): string[] {
  const notes = normaliseNotes(event.notes)
  return [
    `${EVENT_EMOJI[event.type]} ${event.title.trim()}`,
    formatEventTime(event.starts_at, 'share'),
    event.location.trim(),
    ...(notes ? [notes] : []),
    '',
  ]
}

/** The initial share message (D13). Five lines, six when notes are present. No trailing newline. */
export function buildShareMessage(event: ShareEvent): string {
  return [...eventHeader(event), `Are you available? ${eventUrl(event.id)}`].join('\n')
}

/**
 * The reminder variant (S5.3, D13). Same header block as `buildShareMessage`, reusing
 * `eventHeader` so the two can never drift, with only the last line changed to the outstanding
 * count. Takes a `number`, never a list of people, so it is structurally incapable of naming or
 * @-mentioning a non-responder (Q9, AC3). `outstanding` is the `awaiting` field of `deriveCounts`
 * (D22); a positive integer is the only valid input, so `0`, negatives and fractions throw rather
 * than emit a nonsense "0 still to answer" the UI should never have asked for (AC5).
 */
export function buildReminderMessage(event: ShareEvent, outstanding: number): string {
  if (!Number.isInteger(outstanding) || outstanding < 1) {
    throw new RangeError('buildReminderMessage: outstanding must be a positive integer')
  }
  return [
    ...eventHeader(event),
    `${String(outstanding)} still to answer. Yes or no: ${eventUrl(event.id)}`,
  ].join('\n')
}

/** One picked player as the teamsheet renders them: shirt number, name, and the armband. Names are
 *  resolved from the team directory at the call site, so this generator stays pure and never
 *  reaches for a profile — the same rule the header block follows. */
export interface MatchShareSquadMember {
  shirtNumber: number
  name: string
  isCaptain: boolean
}

/** The match fields the teamsheet reads. Narrower than the row; `opponent`/`home_away` are non-null
 *  for a real match but typed nullable on the row, so the generator coalesces defensively. `id` is
 *  carried so the message can end with the event link a player taps to register or respond. */
export type MatchShareEvent = Pick<
  EventRow,
  'id' | 'opponent' | 'home_away' | 'location' | 'starts_at' | 'meet_at'
>

/**
 * The match teamsheet (V8, amending D13's match variant). The club's real WhatsApp format:
 *
 *   {team} vs {opponent}
 *   KO: {kickoff} | Meet: {meet}     ← "| Meet: …" dropped when meet_at is null
 *   Home Game: Bogies                ← home; away → "Away: {location}"
 *                                    ← blank line, then the squad, only when one is picked
 *   Squad:
 *    1. {name}
 *    2. {name}
 *    3. {name} (C)                   ← the captain
 *   ...
 *   20. {name}
 *
 * Numbers are right-aligned to two columns as in the club message. No squad → the fixture block
 * stands alone, so a manager shares the fixture first and the picked side later. Every match share
 * ends with a blank line then the event link — `Are you available? {url}` — exactly like the
 * availability share, so a player tapping it from WhatsApp can register or set their availability
 * whether or not a squad is published. (Restored 2026-09-15: the teamsheet had shipped linkless,
 * dead-ending anyone not already in the app.) Pure: times come from `formatEventTime`'s 'clock24'
 * variant (D35, Dublin), the home label from the one `HOME_VENUE` constant (S8.4), the link from
 * `eventUrl` (S0.3). Byte-for-byte in Vitest, so a wording change is a test edit.
 */
export function buildMatchShareMessage(
  event: MatchShareEvent,
  teamName: string,
  squad: readonly MatchShareSquadMember[],
): string {
  const ko = formatEventTime(event.starts_at, 'clock24')
  const koLine =
    event.meet_at === null
      ? `KO: ${ko}`
      : `KO: ${ko} | Meet: ${formatEventTime(event.meet_at, 'clock24')}`
  const venueLine =
    event.home_away === 'home' ? `Home Game: ${HOME_VENUE.label}` : `Away: ${event.location.trim()}`

  const lines = [`${teamName.trim()} vs ${(event.opponent ?? '').trim()}`, koLine, venueLine]

  if (squad.length > 0) {
    lines.push('', 'Squad:')
    for (const player of [...squad].sort((a, b) => a.shirtNumber - b.shirtNumber)) {
      const number = String(player.shirtNumber).padStart(2, ' ')
      lines.push(`${number}. ${player.name.trim()}${player.isCaptain ? ' (C)' : ''}`)
    }
  }

  // Always close with the event link so the share is never a dead end: a new player taps it to
  // register (S2.4), an existing one to set availability (S3.4). Same call-to-action as the
  // non-match availability share so the two never drift.
  lines.push('', `Are you available? ${eventUrl(event.id)}`)

  return lines.join('\n')
}

/** A `wa.me` link that opens the chat picker with the message prefilled. The body is
 *  percent-encoded because it contains the `#` of the hash route, which an unencoded body is
 *  silently truncated at on a real phone (D52). No `&phone=`: an empty target opens the picker,
 *  which is what a manager sharing into an existing group wants. */
export function waMeUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
