import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Counts } from '@/lib/counts'

interface Tile {
  key: keyof Counts
  label: string
  /** Awaiting is the one a manager acts on — it drives the S5.3 reminder — so it reads loudest. */
  emphasis?: boolean
}

const TILES: readonly Tile[] = [
  { key: 'available', label: 'Available' },
  { key: 'unavailable', label: 'Unavailable' },
  { key: 'awaiting', label: 'Awaiting', emphasis: true },
  { key: 'squad', label: 'Squad' },
]

/**
 * The four counts as a 2×2 grid of tiles at 375px (AC3): a number over a label, each tile taller
 * than a touch target, no horizontal scroll. Awaiting is emphasised. The numbers are derived by
 * the caller from the squad and the responses (D22); this is presentation only.
 */
export function EventCountsPanel({ counts }: { counts: Counts }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Response counts">
      {TILES.map((tile) => (
        <Card
          key={tile.key}
          size="sm"
          className={cn(
            'min-h-tap items-center justify-center gap-0.5 py-4 text-center',
            tile.emphasis && 'bg-primary/5 ring-primary/20',
          )}
        >
          <span
            className={cn(
              'text-3xl font-semibold tabular-nums',
              tile.emphasis ? 'text-primary' : 'text-foreground',
            )}
          >
            {counts[tile.key]}
          </span>
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {tile.label}
          </span>
        </Card>
      ))}
    </div>
  )
}

/** The count tiles' shape while the responses or the directory are still loading (AC13). */
export function EventCountsPanelSkeleton(): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-2 gap-3"
      role="status"
      aria-busy="true"
      aria-label="Loading counts"
    >
      {TILES.map((tile) => (
        <Card key={tile.key} size="sm" className="min-h-tap items-center justify-center gap-1 py-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </div>
  )
}
