import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { eventKeys, teamKeys, userKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import {
  byActiveThenName,
  teamRowSchema,
  type CreateTeamInput,
  type Team,
} from '@/features/teams/schema'

/**
 * The client half of the `teams` RLS policies S1.3 already shipped (S6.1). Admins select,
 * insert and update every team; a non-admin write affects zero rows, which is the enforcement —
 * the redirect on `/admin` is convenience. There is no delete hook and no delete policy: a team
 * is retired by `active = false`, never removed (D8, D31, D50).
 *
 * Table writes surface their `PostgrestError` raw rather than an `AppError`, so the screen can
 * map a `23505` on `teams_name_key` to field copy (isUniqueViolation) and leave everything else
 * to the shared rollback path.
 */

const teamsSchema = z.array(teamRowSchema)

export function teamsOptions() {
  return queryOptions({
    queryKey: teamKeys.all,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase.from('teams').select('*')
      if (error) throw error
      return teamsSchema.parse(data)
    },
    // Sorted here, not in the component, so every consumer sees the same order (AC8).
    select: (rows: Team[]) => [...rows].sort(byActiveThenName),
  })
}

export function useTeams(): UseQueryResult<Team[]> {
  return useQuery(teamsOptions())
}

/** Not optimistic: it needs the server-generated id. Pending state on the button, invalidate on success. */
export function useCreateTeam(): UseMutationResult<Team, PostgrestError, CreateTeamInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name }): Promise<Team> => {
      const { data, error } = await supabase.from('teams').insert({ name }).select('*').single()
      if (error) throw error
      return teamRowSchema.parse(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

/** Optimistic rename following the D48 rollback pattern: snapshot, restore on error, invalidate on settle. */
export function useRenameTeam(): UseMutationResult<
  Team,
  PostgrestError,
  { id: string; name: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }): Promise<Team> => {
      const { data, error } = await supabase
        .from('teams')
        .update({ name })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return teamRowSchema.parse(data)
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: teamKeys.all })
      const previous = qc.getQueryData<Team[]>(teamKeys.all)
      if (previous) {
        qc.setQueryData<Team[]>(
          teamKeys.all,
          previous.map((t) => (t.id === id ? { ...t, name } : t)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(teamKeys.all, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

/** Optimistic active toggle, same rollback pattern. Deactivate and reactivate both go through here. */
export function useSetTeamActive(): UseMutationResult<
  Team,
  PostgrestError,
  { id: string; active: boolean }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }): Promise<Team> => {
      const { data, error } = await supabase
        .from('teams')
        .update({ active })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return teamRowSchema.parse(data)
    },
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: teamKeys.all })
      const previous = qc.getQueryData<Team[]>(teamKeys.all)
      if (previous) {
        qc.setQueryData<Team[]>(
          teamKeys.all,
          previous.map((t) => (t.id === id ? { ...t, active } : t)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(teamKeys.all, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

export interface JoinedTeam {
  teamId: string
  teamName: string
}

/**
 * Joins the caller to the team that owns an event, as a player (D6). The event link is a standing
 * join credential with the same trust basis as the squad WhatsApp group, so this is the join S3.3
 * offers a signed-in non-member. The RPC returns a set of one row and raises `invalid_invite` for
 * an inactive team, an unknown event, or one that started more than seven days ago;
 * `noUncheckedIndexedAccess` makes the empty-set guard a compile requirement rather than a choice.
 *
 * `userKeys.current()` is the invalidation that re-renders S3.3 as the member view without a
 * reload (AC10): the membership query refetches, the detail read is enabled, and the buttons
 * appear. `eventKeys.all` refreshes the event itself.
 */
export function useJoinTeamByEvent(): UseMutationResult<JoinedTeam, AppError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string): Promise<JoinedTeam> => {
      const rows = await callRpc('join_team_by_event', { p_event_id: eventId })
      const row = rows[0]
      if (!row) throw new AppError('invalid_invite')
      return { teamId: row.team_id, teamName: row.team_name }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.all })
      void qc.invalidateQueries({ queryKey: userKeys.current() })
    },
  })
}
