/**
 * The pure core of the subs feature (Epic 19). One club-wide amount is owed by everyone (Y1); a
 * member's outstanding is that amount minus what they've paid (Y2), derived here so the admin list,
 * the manager view, the profile card and the reminder modal all agree. No React, no Supabase — the
 * screens hand it members + payments + the amount and render the result.
 */

/** One member's subs standing. */
export interface SubsRow {
  userId: string
  name: string
  amountDue: number
  paid: number
  outstanding: number
}

/** Sum a member's part-payments and derive their outstanding, clamped at zero (an overpayment reads
 *  as fully paid, never negative). Ordered most-owing first, then by name — the collection worklist. */
export function buildSubsRows(
  members: readonly { userId: string; name: string }[],
  payments: readonly { user_id: string; amount: number }[],
  amountDue: number,
): SubsRow[] {
  const paidByUser = new Map<string, number>()
  for (const p of payments) paidByUser.set(p.user_id, (paidByUser.get(p.user_id) ?? 0) + p.amount)
  return members
    .map((m) => {
      const paid = paidByUser.get(m.userId) ?? 0
      return {
        userId: m.userId,
        name: m.name,
        amountDue,
        paid,
        outstanding: Math.max(0, amountDue - paid),
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name))
}

/** Totals across a list (the admin/manager summary). */
export interface SubsSummary {
  members: number
  paidUp: number
  totalDue: number
  totalPaid: number
  totalOutstanding: number
}

export function summariseSubs(rows: readonly SubsRow[]): SubsSummary {
  return {
    members: rows.length,
    paidUp: rows.filter((r) => r.outstanding === 0).length,
    totalDue: rows.reduce((n, r) => n + r.amountDue, 0),
    totalPaid: rows.reduce((n, r) => n + r.paid, 0),
    totalOutstanding: rows.reduce((n, r) => n + r.outstanding, 0),
  }
}

/** One member's own standing, from their payments and the club amount (the profile card / modal). */
export function mySubs(
  payments: readonly { amount: number }[],
  amountDue: number,
): { amountDue: number; paid: number; outstanding: number } {
  const paid = payments.reduce((n, p) => n + p.amount, 0)
  return { amountDue, paid, outstanding: Math.max(0, amountDue - paid) }
}

/** Euro to two places, e.g. `€100.00`. One place so the app never drifts on how money reads. */
export function formatMoney(amount: number): string {
  return `€${amount.toFixed(2)}`
}
