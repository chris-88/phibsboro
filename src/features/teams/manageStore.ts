import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * UI state only, never server data (CLAUDE.md §2): which managed team the manager or admin is
 * currently pointed at across the whole manage area. S6.3 gives it the `persist` middleware, so
 * the selection survives a reload and a cold start under `pfc.selectedTeamId` (AC6), and drops
 * S4.1's `?team=` query-param mechanism — the two must never run at once.
 *
 * `persist` writes `{"state":{"selectedTeamId":"<uuid>"},"version":0}` under that key. Clearing
 * site data resets it to null and `useActiveTeam` falls back to the first managed team — correct
 * behaviour, not a bug.
 */
interface ManageStore {
  selectedTeamId: string | null
  setSelectedTeamId: (teamId: string) => void
}

export const useManageStore = create<ManageStore>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      setSelectedTeamId: (selectedTeamId) => {
        set({ selectedTeamId })
      },
    }),
    { name: 'pfc.selectedTeamId' },
  ),
)
