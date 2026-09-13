export const LOCAL_VERSION = 'local'

/**
 * The build a player is running, for the version tag and for a bug report from a car park.
 * Reads the `pfc-release` meta S0.5 substitutes from the commit SHA at build time; the
 * only reader of that tag in the app. `local` in `npm run dev`, where the tag holds the
 * unsubstituted placeholder or `.env.local`'s literal. Never throws.
 */
export function getAppVersion(
  doc: Pick<Document, 'querySelector'> | undefined = safeDocument(),
): string {
  try {
    const content = doc?.querySelector('meta[name="pfc-release"]')?.getAttribute('content')?.trim()
    if (!content || content.startsWith('%')) return LOCAL_VERSION
    return content.slice(0, 7)
  } catch {
    return LOCAL_VERSION
  }
}

function safeDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document
}
