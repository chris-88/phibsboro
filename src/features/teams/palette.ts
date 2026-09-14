/**
 * The fixed, accessible team-colour palette (S10.1, V9). Each entry is a saturated 700-level
 * hue that reads as a filled dot on the calendar ground in both light and dark. The swatch
 * picker offers only these; the Zod schema and the DB check both refuse anything else, so a
 * team's colour is always one of these values. S10.2 keys the calendar dots off it.
 *
 * This is the one place in `src/` that holds colour hex literals outside the token sheet — the
 * value is stored per-row in the database and cannot live in `index.css` — so it is allowlisted
 * in scripts/check-conventions.mjs (hardcoded-hex).
 */
export const TEAM_PALETTE = [
  { value: '#1e40af', name: 'Blue' },
  { value: '#b91c1c', name: 'Red' },
  { value: '#15803d', name: 'Green' },
  { value: '#c2410c', name: 'Orange' },
  { value: '#7e22ce', name: 'Purple' },
  { value: '#0f766e', name: 'Teal' },
  { value: '#be185d', name: 'Pink' },
  { value: '#334155', name: 'Slate' },
] as const

/** The column default (S10.1 migration). Firsts keeps this; Seconds is seeded a distinct entry. */
export const TEAM_COLOUR_DEFAULT = '#1e40af'

export type TeamColour = (typeof TEAM_PALETTE)[number]['value']

/** The palette values as a tuple, for `z.enum` and membership checks. */
export const TEAM_PALETTE_VALUES = TEAM_PALETTE.map((c) => c.value) as [TeamColour, ...TeamColour[]]

/** The label for a stored colour, or the raw value if it is somehow off-palette (defensive). */
export function teamColourName(value: string): string {
  return TEAM_PALETTE.find((c) => c.value === value)?.name ?? value
}
