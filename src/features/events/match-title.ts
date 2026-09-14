import type { Enums } from '@/lib/db'

export type HomeAway = Enums<'home_away'>

export interface MatchTitleInput {
  /** The manager's own team. */
  teamName: string
  /** The other team. */
  opponent: string
  /** Which side is at home. Drives the order — home team first (football convention, V3). */
  homeAway: HomeAway
  /** `'v'` on screen (the stored title), `'vs'` in the WhatsApp share (S9.3). Defaults to `'v'`. */
  sep?: string
}

/** Trim and collapse every run of whitespace to a single space, so a stray double space or a
 *  pasted newline never reaches the stored title. */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * The one place a match title is built (V3, S8.2). Home → `{team} v {opponent}`, away →
 * `{opponent} v {team}` — the home team is always named first. Pure: no clock, no team lookup, no
 * React. The form calls it for the live preview and, on submit, to fill `events.title`; the stored
 * title is the `sep = 'v'` form, so every existing reader of the column keeps working.
 *
 * With an empty opponent it returns a partial string (e.g. `"Firsts v"`); the form's schema blocks
 * the submit before that is stored, so the partial only ever shows as a live preview.
 */
export function matchTitle({ teamName, opponent, homeAway, sep = 'v' }: MatchTitleInput): string {
  const team = collapse(teamName)
  const opp = collapse(opponent)
  const [first, second] = homeAway === 'home' ? [team, opp] : [opp, team]
  return collapse(`${first} ${sep} ${second}`)
}
