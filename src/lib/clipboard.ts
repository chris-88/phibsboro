/**
 * The one clipboard helper in the codebase (S6.2). First needed by the join-link field, then
 * reused by S2.3, S5.2, S6.4 and S2.7. It never assumes a secure context: a manager may be
 * standing in the WhatsApp in-app webview, where `navigator.clipboard` is often absent or
 * refuses. A `false` return is the caller's cue to fall back to a select-it-yourself field,
 * not an error to surface.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    // The DOM lib types `navigator.clipboard` as always present, but it is undefined in an
    // insecure context — exactly the WhatsApp webview case this helper exists for — so the
    // guard is real at runtime even though the type calls it redundant.
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (clipboard) {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the caller's manual-copy fallback */
  }
  return false
}
