import { getAppVersion } from '@/lib/version'

/** The running build, muted and small, so "what version are you on?" has an answer.
 *  In flow at the foot of the shell — never fixed, so it can cover nothing. */
export function VersionTag(): React.JSX.Element {
  return (
    <p data-testid="version-tag" className="text-center text-xs text-muted-foreground">
      <span className="sr-only">Version </span>
      {getAppVersion()}
    </p>
  )
}
