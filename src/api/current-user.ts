import type { Enums, Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/** One membership as it comes back from the join, already flattened off the embedded team. */
export interface CurrentUserMembershipRow {
  teamId: string
  teamName: string
  role: Enums<'member_role'>
  joinedAt: string
}

/** The raw shape the query caches under `userKeys.current()`. The hook derives `CurrentUser`
 *  and its helpers from this (S2.9). */
export interface CurrentUserRow {
  profile: Pick<Tables<'profiles'>, 'id' | 'name' | 'phone' | 'is_admin'>
  memberships: CurrentUserMembershipRow[]
}

/**
 * The signed-in user's own `profiles` row (D8) and the `team_members` rows that belong to
 * them, each with its team name. Two selects in parallel, one query key.
 *
 * The `.eq('id', userId)` on profiles is belt and braces: RLS already scopes that table to the
 * caller's own row (D8). The `.eq('user_id', userId)` on team_members is a correctness filter,
 * not a security one: the S1.3 read policy exposes every row of teams the caller belongs to —
 * the whole squad — so without it `memberships` would carry teammates' rows and AC2 would fail.
 * Dropping it leaks nothing; it just returns the wrong thing. The embedded `teams!inner(name)`
 * resolves under the teams read policy (D8).
 */
export async function fetchCurrentUser(userId: string): Promise<CurrentUserRow> {
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from('profiles').select('id, name, phone, is_admin').eq('id', userId).single(),
    supabase
      .from('team_members')
      .select('team_id, role, joined_at, teams!inner(name)')
      .eq('user_id', userId),
  ])

  if (profileResult.error) throw profileResult.error
  if (membershipResult.error) throw membershipResult.error

  const memberships: CurrentUserMembershipRow[] = membershipResult.data.map((row) => ({
    teamId: row.team_id,
    teamName: row.teams.name,
    role: row.role,
    joinedAt: row.joined_at,
  }))

  return { profile: profileResult.data, memberships }
}
