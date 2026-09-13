import type { PostgrestError } from '@supabase/supabase-js'

/**
 * The six words an RPC can raise (S1.3 AC23, A12), plus `unknown` for everything else. Copy for
 * each lives in `mapRpcError` and nowhere else, so S2.3, S2.4, S6.2 and S6.4 all say the same
 * thing. No Postgres message, constraint name or column name ever reaches a component.
 */
export const APP_ERROR_CODES = [
  'invalid_invite',
  'invalid_token',
  'not_authorised',
  'phone_taken',
  'series_too_long',
  'starts_in_past',
  'unknown',
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export class AppError extends Error {
  readonly code: AppErrorCode

  /** `cause` keeps the original for Sentry. It is never rendered. */
  constructor(code: AppErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause })
    this.name = 'AppError'
    this.code = code
  }
}

const isKnownCode = (message: string): message is Exclude<AppErrorCode, 'unknown'> =>
  APP_ERROR_CODES.includes(message as AppErrorCode) && message !== 'unknown'

/**
 * An RPC raises exactly one of the six words as its whole message (S1.4 asserts equality, not
 * containment). Anything else — a policy refusal, a constraint, a network failure PostgREST
 * wrapped — becomes `unknown` with the original on `.cause`.
 */
export function toAppError(error: PostgrestError | null): AppError {
  if (error === null) return new AppError('unknown')
  return new AppError(isKnownCode(error.message) ? error.message : 'unknown', error)
}

const COPY: Record<AppErrorCode, string> = {
  invalid_invite: "That link's no good. Ask your manager for a new one.",
  invalid_token: "That link's no good. Ask your manager for a new one.",
  not_authorised: "You can't do that.",
  phone_taken: 'That number is already registered.',
  series_too_long: "That's too many sessions. Pick a shorter run.",
  starts_in_past: 'Pick a date in the future.',
  unknown: 'Something went wrong. Try again.',
}

/** Fixed copy per code. The two token codes share a line on purpose (S1.5 AC10). */
export function mapRpcError(code: AppErrorCode): string {
  return COPY[code]
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e
}

/**
 * A table write (not an RPC) surfaces its `PostgrestError` raw, so S6.1 can tell a
 * case-insensitive duplicate name apart from any other failure and map it to field copy
 * rather than to `unknown`. The constraint is the unique index on `lower(btrim(name))`,
 * `teams_name_key`, so Postgres returns `23505` naming it.
 */
export function isUniqueViolation(e: unknown, constraint: string): boolean {
  return isPostgrestError(e) && e.code === '23505' && e.message.includes(constraint)
}
