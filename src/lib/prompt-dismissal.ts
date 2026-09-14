/**
 * The one owner of the three prompt `localStorage` keys (S2.7, D46). This story writes
 * `pfc.escapePromptDismissed`; S2.8 writes the other two and imports these functions rather than
 * re-implementing them. Every function wraps `localStorage` in try/catch and degrades to "not
 * dismissed, not shown": a private-mode browser that throws still runs the app, the prompt just
 * reappears (AC9). Dismissal is per browser and nothing but these keys carries it, so it
 * deliberately does not follow a player from the WhatsApp webview into Safari (AC10).
 */
type PromptKey = 'escape' | 'install'

const DISMISSED: Record<PromptKey, string> = {
  escape: 'pfc.escapePromptDismissed',
  install: 'pfc.installGuideDismissed',
}
const SHOWN: Record<'install', string> = {
  install: 'pfc.installGuideShown',
}

const STORED = '1'

export function isDismissed(key: PromptKey): boolean {
  try {
    return localStorage.getItem(DISMISSED[key]) === STORED
  } catch {
    return false
  }
}

export function dismiss(key: PromptKey): void {
  try {
    localStorage.setItem(DISMISSED[key], STORED)
  } catch {
    /* private mode threw: the prompt reappears next time, the app is unaffected (AC9) */
  }
}

export function wasShown(key: 'install'): boolean {
  try {
    return localStorage.getItem(SHOWN[key]) === STORED
  } catch {
    return false
  }
}

export function markShown(key: 'install'): void {
  try {
    localStorage.setItem(SHOWN[key], STORED)
  } catch {
    /* no-op: shown-once degrades to shown-again, never to a throw */
  }
}
