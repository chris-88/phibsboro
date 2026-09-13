import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
  type Session,
} from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * The D19 seam. Every `auth.signUp` and `signInWithPassword` in the app is made here and
 * nowhere else, enforced by a `no-restricted-syntax` rule (S2.1 DoD), so if the platform ever
 * needs the synthetic-email fallback it is a one-file change. D19's amendment recorded path A:
 * phone auth works natively on the hosted project, so the phone calls below are live and
 * `syntheticEmail` is unused. It is kept, and typed, so the fallback is a body swap, not a
 * rewrite.
 */

/** The fallback address, `353871234567@phibsboro.invalid`. Unused on path A; see D19. */
export function syntheticEmail(phoneE164: string): string {
  return `${phoneE164.replace(/^\+/, '')}@phibsboro.invalid`
}

/**
 * Every auth outcome the UI can act on, as a discriminated `Error` subclass — the same shape as
 * `AppError`, so it can be thrown under `only-throw-error` and carried as a mutation error type.
 * The Supabase error is kept on `.cause` for Sentry and is never rendered (S2.1 error mapping).
 */
export const AUTH_FAILURE_KINDS = [
  'duplicate_phone',
  'invalid_invite',
  'weak_password',
  'no_session',
  'network',
  'unknown',
] as const

export type AuthFailureKind = (typeof AUTH_FAILURE_KINDS)[number]

export class AuthFailure extends Error {
  readonly kind: AuthFailureKind

  constructor(kind: AuthFailureKind, cause?: unknown) {
    super(kind, cause === undefined ? undefined : { cause })
    this.name = 'AuthFailure'
    this.kind = kind
  }
}

/** The three GoTrue codes that all mean "this number already has an account" (D19 saw
 *  `user_already_exists`; the email fallback would raise `email_exists`; `phone_exists` is the
 *  older shape). One sentence renders for all three (AC8). */
const DUPLICATE_CODES = new Set(['user_already_exists', 'phone_exists', 'email_exists'])

function isPostgresUniquePhone(err: unknown): boolean {
  // The S1.2 trigger's own defence: a duplicate that slipped past GoTrue surfaces as a 23505 on
  // `profiles_phone_key`. Belt and braces — GoTrue rejects first on path A (D19).
  if (typeof err !== 'object' || err === null) return false
  const record = err as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  return record.code === '23505' && message.includes('profiles_phone_key')
}

/**
 * The one place a raw auth or join error becomes a mapped `AuthFailure`. Pure and unit tested,
 * so the copy in S2.1's screen cannot drift from what the platform actually raises.
 */
export function mapAuthError(err: unknown): AuthFailure {
  if (err instanceof AuthFailure) return err
  // The join step raises the shared `AppError`; only `invalid_invite` is meaningful here.
  if (err instanceof AppError) {
    return new AuthFailure(err.code === 'invalid_invite' ? 'invalid_invite' : 'unknown', err)
  }
  if (isAuthWeakPasswordError(err)) return new AuthFailure('weak_password', err)
  if (isAuthRetryableFetchError(err)) return new AuthFailure('network', err)
  if (isAuthApiError(err)) {
    if (err.code !== undefined && DUPLICATE_CODES.has(err.code)) {
      return new AuthFailure('duplicate_phone', err)
    }
    if (err.code === 'weak_password') return new AuthFailure('weak_password', err)
    return new AuthFailure('unknown', err)
  }
  if (isPostgresUniquePhone(err)) return new AuthFailure('duplicate_phone', err)
  // A bare fetch failure (no network) arrives as a TypeError from the SDK's transport.
  if (err instanceof TypeError) return new AuthFailure('network', err)
  return new AuthFailure('unknown', err)
}

/**
 * Sign up with a number, a password and a name. Phone confirmation is off, so this returns a
 * live session in the same call (D19); the name rides in the metadata the S1.2 trigger reads
 * to write `profiles`. Throws a mapped `AuthFailure` on any refusal, and `no_session` if the
 * session is somehow absent — the symptom of phone confirmations being switched back on (AC13).
 */
export async function signUpWithIdentifier(
  phoneE164: string,
  password: string,
  name: string,
): Promise<{ session: Session }> {
  const { data, error } = await supabase.auth.signUp({
    phone: phoneE164,
    password,
    options: { data: { name } },
  })
  if (error) throw mapAuthError(error)
  if (!data.session) throw new AuthFailure('no_session')
  return { session: data.session }
}

/**
 * Sign in with a number and a password. The number is normalised by the shared `toE164` before
 * it reaches here (D35), so a player who typed `+353 87` at signup signs in with `087` (S2.2).
 */
export async function signInWithIdentifier(
  phoneE164: string,
  password: string,
): Promise<{ session: Session }> {
  const { data, error } = await supabase.auth.signInWithPassword({ phone: phoneE164, password })
  if (error) throw mapAuthError(error)
  // signInWithPassword resolves with a session or an error; there is no no-session success path.
  return { session: data.session }
}
