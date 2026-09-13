/**
 * A length-only password hint, so it is honest and testable. It never blocks submit — the
 * schema's min-8 does that (AC6). One line of text under the field, no meter bar, no zxcvbn,
 * no composition advice.
 */
export type PasswordHint = 'short' | 'ok' | 'better'

export function passwordHint(pw: string): PasswordHint {
  return pw.length < 8 ? 'short' : pw.length < 12 ? 'ok' : 'better'
}

/** The one line rendered for each hint. "short" is the same words the schema uses, so the
 *  message a player sees before and after a blocked submit match. */
export const PASSWORD_HINT_COPY: Record<PasswordHint, string> = {
  short: 'At least 8 characters',
  ok: "That'll do",
  better: 'Good',
}
