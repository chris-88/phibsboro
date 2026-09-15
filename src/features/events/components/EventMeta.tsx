import { JERSEY_LABEL, type Jersey } from '@/features/events/schema'
import { LocationText } from '@/features/events/components/LocationText'
import { formatEventTime } from '@/lib/time'

export interface EventMetaProps {
  startsAt: string
  location: string
  /** Match only (S8.3): the arrival time, earlier than kick-off. When set, a "Kick-off … · Meet …"
   *  line is shown; null (training, social, or a match with no meet time) renders nothing extra. */
  meetAt?: string | null
  /** Match only (W7, S15.1): the kit. When set, a "Jersey: …" line is shown; null renders nothing. */
  jersey?: Jersey | null
  /** Member view only. Omitted on the preview, so `notes` never reaches a non-member (D7, AC12).
   *  A null value renders no block and no empty heading (AC2). */
  notes?: string | null
}

/** The date line, the location, and — on the member view only — the notes. The one date on this
 *  screen, always through `formatEventTime` (D35, AC3). A match with a meet time gains a
 *  "Kick-off … · Meet …" line, both in Dublin, 24-hour ('clock24') (S8.3, AC4). */
export function EventMeta({
  startsAt,
  location,
  meetAt,
  jersey,
  notes,
}: EventMetaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-medium text-foreground">{formatEventTime(startsAt, 'share')}</p>
      {meetAt !== null && meetAt !== undefined && (
        <p className="text-sm text-muted-foreground">
          Kick-off {formatEventTime(startsAt, 'clock24')} · Meet{' '}
          {formatEventTime(meetAt, 'clock24')}
        </p>
      )}
      <LocationText location={location} className="text-sm text-muted-foreground" />
      {jersey !== null && jersey !== undefined && (
        <p className="text-sm text-muted-foreground">Jersey: {JERSEY_LABEL[jersey]}</p>
      )}
      {notes !== null && notes !== undefined && notes !== '' && (
        <p className="text-sm whitespace-pre-line text-foreground">{notes}</p>
      )}
    </div>
  )
}
