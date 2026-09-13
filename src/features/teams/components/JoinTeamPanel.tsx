import { Button } from '@/components/ui/button'
import { InviteInvalid } from '@/features/teams/components/InviteInvalid'
import type { JoinFailure } from '@/features/teams/joinErrors'

export interface JoinTeamPanelProps {
  teamName: string
  /** One deliberate tap fires the join (D7) — never an auto-join on load. */
  onJoin: () => void
  /** Disables the button and shows the in-flight label while the mutation runs. */
  pending: boolean
  /** The classified join failure, or null. `'invalid'` replaces the whole panel with the dead-link
   *  screen (AC12); `'network'` keeps the button enabled and shows a retry line under it. */
  failure?: JoinFailure | null
}

/**
 * The single "Join {team}" action for a signed-in visitor who is not yet a member (S2.4): the
 * signed-in path on `/join/:token` and the S3.3 event preview both render it. Anonymous visitors
 * navigate to register or sign in instead, which their own screens own; this panel is only ever
 * the one-tap join.
 */
export function JoinTeamPanel({
  teamName,
  onJoin,
  pending,
  failure = null,
}: JoinTeamPanelProps): React.JSX.Element {
  // A dead link replaces the panel entirely, inline where it was rendered (AC12).
  if (failure === 'invalid') return <InviteInvalid />
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="lg" className="w-full" disabled={pending} onClick={onJoin}>
        Join {teamName}
      </Button>
      {failure === 'network' && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&rsquo;t join. Try again.
        </p>
      )}
    </div>
  )
}
