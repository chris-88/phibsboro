import type { MemberRole } from '@/features/teams/schema'

/**
 * The D10 authorisation rule, as a pure predicate that mirrors `issue_reset_token` (S2.3). It is
 * convenience only — the RPC is the boundary and refuses a mistaken caller regardless — so a row
 * that renders the action but fails cleanly is preferred to a screen that invents authority.
 */
export interface ResetTarget {
  userId: string
  /** The target's role on *this* team. */
  role: MemberRole
  /** True if the target holds `manager` on any team. Not exposed by `team_member_directory`,
   *  so the action component defaults it to false and lets the RPC be the rule. */
  isManagerElsewhere: boolean
  /** Club-wide admin. Also not exposed by the directory; defaulted to false at the call site. */
  isAdmin: boolean
}

export interface ResetViewer {
  isAdmin: boolean
  /** The viewer holds `manager` on this team (a club admin uses the `isAdmin` branch instead). */
  managesThisTeam: boolean
}

/**
 * Admins may reset anyone but another admin. Managers may reset only a `player` on a team they
 * manage who holds `manager` nowhere and is not an admin. Nobody resets an admin through the app.
 */
export function canIssueReset(member: ResetTarget, viewer: ResetViewer): boolean {
  if (viewer.isAdmin) return !member.isAdmin
  if (!viewer.managesThisTeam) return false
  return member.role === 'player' && !member.isManagerElsewhere && !member.isAdmin
}
