import { z } from 'zod'
import type { Enums, Tables } from '@/lib/db'
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

export type Parity = [
  Expect<Equal<MemberRole, Enums<'member_role'>>>,
  Expect<Equal<TeamRow, Tables<'teams'>>>,
  Expect<Equal<TeamMemberRow, Tables<'team_members'>>>,
  Expect<Equal<TeamInvite, Tables<'team_invites'>>>,
]
