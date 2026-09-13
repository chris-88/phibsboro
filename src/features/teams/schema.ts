import { z } from 'zod'
import type { Enums, FnRow, Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/** No `admin` member: admin is `profiles.is_admin`, club-wide (D2). */
export const memberRoleSchema = z.enum(['player', 'manager'])
export type MemberRole = z.infer<typeof memberRoleSchema>

export const teamRowSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(60),
  active: z.boolean(),
  created_at: timestampSchema,
})
export type TeamRow = z.infer<typeof teamRowSchema>

/** The generated row type is the source of truth; `teamRowSchema` proves parity below (D24). */
export type Team = Tables<'teams'>

/**
 * The one team-name rule, shared by the create form and every rename (S6.1). Trims first, so
 * whitespace-only is rejected and a padded name is stored trimmed — the client half of the
 * `char_length(btrim(name)) between 1 and 60` column check.
 */
export const teamNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'Give the team a name.').max(60, 'Keep it under 60 characters.'))

export const createTeamInput = z.object({ name: teamNameSchema })
export type CreateTeamInput = z.infer<typeof createTeamInput>

const nameCollator = new Intl.Collator('en-IE', { sensitivity: 'base' })

/**
 * Active teams first, then by name case-insensitively (S6.1 AC8). `useTeams` sorts in its
 * `select` so every consumer gets the same order and no component re-sorts.
 */
export function byActiveThenName(
  a: Pick<Team, 'active' | 'name'>,
  b: Pick<Team, 'active' | 'name'>,
): number {
  if (a.active !== b.active) return a.active ? -1 : 1
  return nameCollator.compare(a.name, b.name)
}

export const teamMemberRowSchema = z.object({
  team_id: uuidSchema,
  user_id: uuidSchema,
  role: memberRoleSchema,
  joined_at: timestampSchema,
})
export type TeamMemberRow = z.infer<typeof teamMemberRowSchema>

/**
 * Not selectable by any client (S1.3); reachable only through the invite RPCs. The schema
 * exists so a column change nobody told the frontend about still breaks `typecheck` (AC2).
 */
export const teamInviteSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  token: z.string(),
  role: memberRoleSchema,
  active: z.boolean(),
  expires_at: timestampSchema.nullable(),
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
})
export type TeamInvite = z.infer<typeof teamInviteSchema>

/**
 * The four columns `get_team_invite` returns, and all a screen ever sees of an invite (S6.2):
 * the token to copy, its role, its expiry and when it was minted. The full-row `teamInviteSchema`
 * above stays the table-parity guard; this parses the RPC's projection. `expires_at` is kept
 * nullable so a null renders as "No expiry" rather than "Invalid Date" (S6.2 gotcha), even though
 * the player link always carries one.
 */
export const teamInviteViewSchema = z.object({
  token: z.string(),
  role: memberRoleSchema,
  expires_at: timestampSchema.nullable(),
  created_at: timestampSchema,
})
export type TeamInviteView = z.infer<typeof teamInviteViewSchema>

/**
 * The three columns `lookup_team_invite` returns: the team a token joins, its name for the
 * "You're joining Firsts" line (AC2), and the role it grants. A lookup returns zero rows on any
 * failure, so a null result is the dead-link case and never distinguishes expiry from revocation
 * (D28). The team name comes from here, never a `teams` select.
 */
export const teamInviteLookupSchema = z.object({
  team_id: uuidSchema,
  team_name: z.string(),
  role: memberRoleSchema,
})
export type TeamInviteLookup = z.infer<typeof teamInviteLookupSchema>

export type Parity = [
  Expect<Equal<MemberRole, Enums<'member_role'>>>,
  Expect<Equal<TeamRow, Tables<'teams'>>>,
  Expect<Equal<TeamMemberRow, Tables<'team_members'>>>,
  Expect<Equal<TeamInvite, Tables<'team_invites'>>>,
  Expect<Equal<TeamInviteLookup, FnRow<'lookup_team_invite'>>>,
]
