import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { callRpc } from '@/api/rpc'
import { userKeys } from '@/api/queryKeys'
import { clearPendingJoin, readPendingJoin } from '@/features/auth/pending-join'
import type { RegisterValues } from '@/features/auth/schema'
import { AppError } from '@/lib/errors'
import { AuthFailure, mapAuthError, signUpWithIdentifier } from '@/lib/auth'

/**
 * Registration as one user-visible action: sign up, then join, then the caller navigates
 * (S2.1). Three steps, one mutation, one error type — every failure is a mapped `AuthFailure`,
 * so the screen branches on `.kind` and never sees a Supabase or Postgres message.
 *
 * Step 2 failing after step 1 succeeded is a real, specified state: the account exists and the
 * session is live, so both are kept and the screen renders `LinkProblem`. Nothing is rolled
 * back — deleting a freshly created auth user from the browser is impossible, and the account
 * is not the problem, the dead link is (AC9).
 */
function firstTeamName(rows: readonly { team_name: string }[]): string {
  const first = rows[0]
  // The join RPCs return exactly one row on success and raise otherwise (D26); this is defence.
  if (!first) throw new AuthFailure('invalid_invite')
  return first.team_name
}

async function joinPending(): Promise<string> {
  const join = readPendingJoin()
  if (!join) throw new AuthFailure('invalid_invite')

  const call = (): Promise<readonly { team_name: string }[]> =>
    join.kind === 'token'
      ? callRpc('join_team_by_token', { p_token: join.token })
      : callRpc('join_team_by_event', { p_event_id: join.eventId })

  try {
    return firstTeamName(await call())
  } catch (err) {
    // A revoked or expired token is terminal — never retry it. Anything else at this point is a
    // transient failure between two servers, and the join is idempotent (D26), so retry once.
    if (err instanceof AppError && err.code === 'invalid_invite') {
      throw new AuthFailure('invalid_invite', err)
    }
    try {
      return firstTeamName(await call())
    } catch (retryErr) {
      throw mapAuthError(retryErr)
    }
  }
}

export function useRegister(): UseMutationResult<
  { teamName: string },
  AuthFailure,
  RegisterValues
> {
  const qc = useQueryClient()
  return useMutation<{ teamName: string }, AuthFailure, RegisterValues>({
    mutationFn: async (values): Promise<{ teamName: string }> => {
      await signUpWithIdentifier(values.phone, values.password, values.name)
      const teamName = await joinPending()
      return { teamName }
    },
    onSuccess: () => {
      clearPendingJoin()
      // The current-user query is refetched so the new membership and profile are live before
      // the caller navigates home (S2.9's userKeys.current()).
      void qc.invalidateQueries({ queryKey: userKeys.current() })
    },
  })
}
