import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { z } from 'zod'
import { teamKeys, userKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { type MemberRole } from '@/features/teams/schema'
import type { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/** One team a user belongs to, with their role there (S14.2). */
export interface AdminUserMembership {
  teamId: string
  teamName: string
  role: MemberRole
}

/** One person in the admin user manager: profile plus every team membership (S14.2). */
export interface AdminUser {
  id: string
  name: string
  phone: string
  memberships: AdminUserMembership[]
}

const profileSchema = z.object({ id: z.string(), name: z.string(), phone: z.string() })
const membershipSchema = z.object({
  team_id: z.string(),
  user_id: z.string(),
  role: z.enum(['player', 'manager']),
})
const teamSchema = z.object({ id: z.string(), name: z.string() })

/**
 * Every person and the teams/roles they hold (S14.2, W6). Admin-only in practice — the screen is
 * guarded and RLS returns all profiles only to an admin (the `profiles_select_admin` policy) — and
 * composed client-side from three admin reads: profiles, team_members and teams. No security-definer
 * directory RPC: with the admin profiles policy the three plain reads suffice, and the compose keeps
 * team names local. Sorted by name; each user's memberships by team name.
 */
export function useAllUsers(): UseQueryResult<AdminUser[]> {
  return useQuery({
    queryKey: userKeys.allUsers(),
    queryFn: async (): Promise<AdminUser[]> => {
      const [p, m, t] = await Promise.all([
        supabase.from('profiles').select('id, name, phone'),
        supabase.from('team_members').select('team_id, user_id, role'),
        supabase.from('teams').select('id, name'),
      ])
      if (p.error) throw p.error
      if (m.error) throw m.error
      if (t.error) throw t.error
      const profiles = z.array(profileSchema).parse(p.data)
      const members = z.array(membershipSchema).parse(m.data)
      const teams = z.array(teamSchema).parse(t.data)

      const teamName = new Map(teams.map((x) => [x.id, x.name]))
      const byUser = new Map<string, AdminUserMembership[]>()
      for (const mem of members) {
        const list = byUser.get(mem.user_id) ?? []
        list.push({
          teamId: mem.team_id,
          teamName: teamName.get(mem.team_id) ?? 'Unknown team',
          role: mem.role,
        })
        byUser.set(mem.user_id, list)
      }
      return profiles
        .map((pr) => ({
          id: pr.id,
          name: pr.name,
          phone: pr.phone,
          memberships: (byUser.get(pr.id) ?? []).sort((a, b) =>
            a.teamName.localeCompare(b.teamName),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

/**
 * Assign a user to a team, or set the exact role of an existing membership (S14.2), through the
 * admin-only `admin_set_membership` RPC (W6). Upsert semantics: an admin may downgrade as well as
 * upgrade, unlike the join-link flow. Invalidates the all-users directory and the team caches.
 */
export function useAdminSetMembership(): UseMutationResult<
  void,
  AppError,
  { teamId: string; userId: string; role: MemberRole }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId, role }) => {
      await callRpc('admin_set_membership', { p_team_id: teamId, p_user_id: userId, p_role: role })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.allUsers() })
      void qc.invalidateQueries({ queryKey: teamKeys.all })
    },
  })
}

/**
 * Remove a user from a team (S14.2) through `remove_member` (admin or team manager; here always an
 * admin). Historic responses and attendance survive (D33). Invalidates the all-users directory.
 */
export function useAdminRemoveMembership(): UseMutationResult<
  void,
  AppError,
  { teamId: string; userId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ teamId, userId }) => {
      await callRpc('remove_member', { p_team_id: teamId, p_user_id: userId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.allUsers() })
    },
  })
}
