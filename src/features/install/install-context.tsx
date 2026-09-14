import { createContext, useContext } from 'react'
import type { InstallContext } from '@/lib/install-context'

/**
 * The React side of the install context: the context object and its hook, kept in their own module
 * so `install-provider.tsx` exports only its component and stays a clean fast-refresh boundary — the
 * same split S2.9 uses for `session-context.ts` / `session-provider.tsx`. The pure classification
 * rules live separately in `@/lib/install-context`.
 */
export interface InstallContextValue {
  context: InstallContext
  /** S2.8's Install button calls this; null until `beforeinstallprompt` has been captured. */
  promptInstall: (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null
}

export const InstallReactContext = createContext<InstallContextValue | null>(null)

/**
 * Never throws on a missing provider. The prompts hang off the availability controls, and S2.7's
 * definition of done is that no path can prevent, delay or undo a response — a throw here would
 * crash the event screen and take the YES / NO buttons with it. Absent a provider we resolve to
 * `other`, which shows no prompt: the safe direction is silence, never a broken screen.
 */
export function useInstallContext(): InstallContextValue {
  return useContext(InstallReactContext) ?? { context: 'other', promptInstall: null }
}
