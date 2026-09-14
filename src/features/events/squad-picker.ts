/**
 * The pure model behind the squad picker (S9.2). No imports from `src/api/`, no PostgREST shapes
 * and no Supabase client, so its Vitest cases run with no database — the same rule `buildRoster()`
 * and `deriveCounts()` follow. The screen maps its snake_case rows to these shapes at the call
 * site, so the derivation owes nothing to the wire.
 *
 * Pool = available responders only (V7). A picked player who has since gone unavailable stays in
 * the squad, flagged and still removable; the pool never offers a non-available player.
 */

const MAX_SQUAD = 20

export interface PickerMember {
  readonly userId: string
  readonly name: string
}
export interface PickerResponse {
  readonly userId: string
  /** 'available' | 'unavailable'; absent from the array means awaiting. */
  readonly response: string
}
export interface PickerPick {
  readonly userId: string
  readonly shirtNumber: number
  readonly isCaptain: boolean
}

export interface PickerEntry {
  readonly userId: string
  readonly name: string
  readonly picked: boolean
  /** Set only when picked. */
  readonly shirtNumber: number | null
  readonly isCaptain: boolean
  /** Has an `available` response. */
  readonly available: boolean
  /** Picked but no longer available (V7): shown flagged, still removable/renumberable. */
  readonly unavailableFlag: boolean
}

export interface PickerModel {
  /** The picked side, shirt-number order. */
  readonly picked: PickerEntry[]
  /** Available and not yet picked, name order — the pool to add from. */
  readonly available: PickerEntry[]
  /** How many are picked (drives the "{n} / 20" count and the cap). */
  readonly count: number
  readonly takenNumbers: ReadonlySet<number>
  /** Lowest free number 1–20, or null when the squad is full. */
  readonly nextFreeNumber: number | null
  readonly atCapacity: boolean
  readonly captainUserId: string | null
}

const collator = new Intl.Collator('en-IE', { sensitivity: 'base' })

/**
 * The one-line squad status shown on the Squad-tab matchday row and the match manager view (S9.2):
 * "Squad not picked" before anyone is in, else "{n} picked" with a captain note when named.
 */
export function squadStatusText(count: number, hasCaptain: boolean): string {
  if (count === 0) return 'Squad not picked'
  return hasCaptain ? `${String(count)} picked · captain named` : `${String(count)} picked`
}

/** The free numbers 1–20, ascending — the override list a picked row's number Select offers. */
export function freeNumbers(taken: ReadonlySet<number>): number[] {
  const free: number[] = []
  for (let n = 1; n <= MAX_SQUAD; n += 1) {
    if (!taken.has(n)) free.push(n)
  }
  return free
}

/**
 * Build the picker's view from the three cached reads. Entries cover every available member plus
 * any picked player who is no longer available (so a flagged pick can still be removed). Picked
 * rows sort by shirt number; the pool sorts by name then userId, stable across polls.
 */
export function buildPickerModel(
  members: readonly PickerMember[],
  responses: readonly PickerResponse[],
  picks: readonly PickerPick[],
): PickerModel {
  const nameByUser = new Map(members.map((m) => [m.userId, m.name]))
  const availableUsers = new Set(
    responses.filter((r) => r.response === 'available').map((r) => r.userId),
  )
  const pickByUser = new Map(picks.map((p) => [p.userId, p]))

  const userIds = new Set<string>()
  for (const userId of availableUsers) userIds.add(userId)
  for (const p of picks) userIds.add(p.userId)

  const entries: PickerEntry[] = [...userIds].map((userId) => {
    const pick = pickByUser.get(userId) ?? null
    const available = availableUsers.has(userId)
    return {
      userId,
      name: nameByUser.get(userId) ?? 'Former member',
      picked: pick !== null,
      shirtNumber: pick?.shirtNumber ?? null,
      isCaptain: pick?.isCaptain ?? false,
      available,
      unavailableFlag: pick !== null && !available,
    }
  })

  const picked = entries
    .filter((e) => e.picked)
    .sort((a, b) => (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0))
  const available = entries
    .filter((e) => !e.picked && e.available)
    .sort((a, b) => {
      const byName = collator.compare(a.name, b.name)
      return byName !== 0 ? byName : a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
    })

  const takenNumbers = new Set(picks.map((p) => p.shirtNumber))
  const free = freeNumbers(takenNumbers)
  const captain = picks.find((p) => p.isCaptain) ?? null

  return {
    picked,
    available,
    count: picked.length,
    takenNumbers,
    nextFreeNumber: free[0] ?? null,
    atCapacity: picked.length >= MAX_SQUAD,
    captainUserId: captain?.userId ?? null,
  }
}

export { MAX_SQUAD }
