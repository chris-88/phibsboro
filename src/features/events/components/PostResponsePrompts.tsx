import { useReducer } from 'react'
import { EscapePrompt } from '@/features/install/escape-prompt'
import { useInstallContext } from '@/features/install/install-context'
import { isDismissed } from '@/lib/prompt-dismissal'
import { usePromptStore } from '@/stores/prompt-store'

/**
 * The single seam S2.7 (escape the WhatsApp browser) and S2.8 (add to home screen) build on, and
 * the one place their exclusivity is decided (D46): the two can never both be on screen because one
 * component chooses. Nothing renders until the player has successfully responded this session
 * (AC4). In an in-app webview the escape prompt shows and the install guide never does, because
 * installing is impossible where the player is standing (AC11).
 *
 * The `installable` and `ios-safari` branches — S2.8's Install button and written steps — are left
 * to S2.8; they render nothing here yet. `resolving` (the Android window), `standalone` and `other`
 * always render nothing.
 */
export function PostResponsePrompts(): React.JSX.Element | null {
  const { context } = useInstallContext()
  const hasResponded = usePromptStore((s) => s.hasRespondedThisSession)
  // A dismiss writes localStorage; bump this so the gate re-reads it and the prompt drops out.
  const [, rereadDismissal] = useReducer((n: number) => n + 1, 0)

  if (!hasResponded) return null

  if (context === 'ios-inapp' || context === 'android-inapp') {
    return isDismissed('escape') ? null : (
      <EscapePrompt platform={context} onDismiss={rereadDismissal} />
    )
  }

  return null
}
