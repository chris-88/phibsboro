import { AppError, mapRpcError, type AppErrorCode } from '@/lib/errors'

/**
 * The recurring-training form knows a context the RPC does not, so it sharpens three of the six
 * generic lines (S4.6). Anything unlisted falls through to `mapRpcError` (S1.5), so 'unknown'
 * still reads "Something went wrong. Try again." and no raw Postgres text ever reaches a manager.
 * `not_authorised` deliberately covers both the wrong-team and the deactivated-team case: S1.3
 * raises one code for both, and the manager's fix is the same either way.
 */
export const SERIES_ERROR_COPY: Partial<Record<AppErrorCode, string>> = {
  not_authorised: "You can't create training for this team.",
  series_too_long: 'Pick 16 weeks or fewer.',
  starts_in_past: 'Pick a date in the future.',
}

/** One line of copy for a failed generate. `callRpc` throws an `AppError` with a typed code
 *  (S1.5); anything else is treated as `unknown`. */
export function seriesErrorMessage(err: unknown): string {
  const code: AppErrorCode = err instanceof AppError ? err.code : 'unknown'
  return SERIES_ERROR_COPY[code] ?? mapRpcError(code)
}
