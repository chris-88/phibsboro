import { create } from 'zustand'

/**
 * UI state only, never server data (CLAUDE.md §2): which managed team the manager is currently
 * looking at on `/manage`. Not persisted here — a hard refresh of `/manage/event/new` survives on
 * the `?team=` query parameter instead (S4.1 AC8). S6.3 adds `persist` and drops the query-param
 * read; do not run both mechanisms at once.
 */
interface ManageStore {
  selectedTeamId: string | null
  setSelectedTeamId: (teamId: string | null) => void
}

export const useManageStore = create<ManageStore>((set) => ({
  selectedTeamId: null,
  setSelectedTeamId: (selectedTeamId) => {
    set({ selectedTeamId })
  },
}))
