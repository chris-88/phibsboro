/**
 * The one phone normaliser (D35). Registration and sign-in both call it, so a player who typed
 * `+353 87` at signup can sign in with `087` (S2.2). Returns `null` rather than throwing; the
 * caller renders the field error.
 */

/** Any E.164 number: `+`, a non-zero lead, 8 to 15 digits in all. Matches `profiles.phone`'s check. */
const E164 = /^\+[1-9]\d{7,14}$/

/** Irish mobiles only — 083, 085, 086, 087, 089 — because this app can only reach people on
 *  mobiles. A landline normalises cleanly and is then refused here. */
const IRISH_MOBILE = /^\+3538[35679]\d{7}$/

export function toE164(input: string): string | null {
  const trimmed = input.trim()
  // Keep a leading '+', drop everything that is not an ASCII digit: spaces, brackets, dots,
  // unicode dashes, non-breaking spaces, and any '+' that is not first.
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits === '') return null

  let candidate: string
  if (plus) candidate = `+${digits}`
  else if (digits.startsWith('00')) candidate = `+${digits.slice(2)}`
  else if (digits.startsWith('0')) candidate = `+353${digits.slice(1)}`
  else if (digits.startsWith('353')) candidate = `+${digits}`
  else return null

  if (!E164.test(candidate)) return null
  if (candidate.startsWith('+353') && !IRISH_MOBILE.test(candidate)) return null
  return candidate
}
