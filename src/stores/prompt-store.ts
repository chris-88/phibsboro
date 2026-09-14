import { create } from 'zustand'

/**
 * UI state only, never server data (CLAUDE.md §2): has the player successfully submitted a response
 * in this session (S2.7). `markResponded()` is called from the `onSuccess` of `useSetResponse`
 * (S3.1), never `onMutate` — an optimistic write the D12 policy then rejects must not raise a
 * prompt (AC4). Not persisted: it resets on reload, and the escape-prompt dismissal key (owned by
 * `prompt-dismissal.ts`) is what stops a repeat showing (AC9), not this flag.
 */
interface PromptStore {
  hasRespondedThisSession: boolean
  markResponded: () => void
}

export const usePromptStore = create<PromptStore>((set) => ({
  hasRespondedThisSession: false,
  markResponded: () => {
    set({ hasRespondedThisSession: true })
  },
}))
