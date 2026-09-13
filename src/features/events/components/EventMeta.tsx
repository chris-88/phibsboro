import { formatEventTime } from '@/lib/time'

export interface EventMetaProps {
  startsAt: string
  location: string
  /** Member view only. Omitted on the preview, so `notes` never reaches a non-member (D7, AC12).
   *  A null value renders no block and no empty heading (AC2). */
  notes?: string | null
}

/** The date line, the location, and — on the member view only — the notes. The one date on this
 *  screen, always through `formatEventTime` (D35, AC3). */
export function EventMeta({ startsAt, location, notes }: EventMetaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-medium text-foreground">{formatEventTime(startsAt, 'share')}</p>
      <p className="text-sm text-muted-foreground">{location}</p>
      {notes !== null && notes !== undefined && notes !== '' && (
        <p className="text-sm whitespace-pre-line text-foreground">{notes}</p>
      )}
    </div>
  )
}
