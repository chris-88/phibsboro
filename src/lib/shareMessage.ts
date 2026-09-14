/**
 * The one place the WhatsApp share text is built. The format is fixed literally by D13 and
 * asserted byte for byte in Vitest, so a wording change is a deliberate edit to a test, not a
 * drift. Pure: no `Date.now()`, no `navigator`, no `window`, no network, no React. The date line
 * comes from `formatEventTime` (D35) and the link from `eventUrl` (S0.3) — this module contains
 * no hash-route literal, does no date formatting, and never reads `import.meta.env`.
 */
import type { Tables } from '@/lib/db'
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

/** A `wa.me` link that opens the chat picker with the message prefilled. The body is
 *  percent-encoded because it contains the `#` of the hash route, which an unencoded body is
 *  silently truncated at on a real phone (D52). No `&phone=`: an empty target opens the picker,
 *  which is what a manager sharing into an existing group wants. */
export function waMeUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
