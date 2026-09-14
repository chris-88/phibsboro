/**
 * The single seam S2.7 (escape the WhatsApp browser) and S2.8 (add to home screen) build on. This
 * story ships the mount point only and renders nothing; D46 decides which of the two shows once
 * they exist. No detection, no localStorage, no copy here — this is a mount point, not a TODO for
 * out-of-scope work. S2.7 / S2.8 add the props (the event id, the detected platform) they need
 * when they fill it in; nothing in this story reads a prop, so it takes none yet.
 */
export function PostResponsePrompts(): React.JSX.Element | null {
  return null
}
