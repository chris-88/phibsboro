import { Check, Minus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AvailabilityResponse } from '@/features/availability/schema'

export interface ResponsePillProps {
  /** The player's own answer, or `null` while awaiting. `null` renders "Awaiting" — absence is the
   *  third state, never a stored value (D12, D25). */
  response: AvailabilityResponse | null
  /** Overrides the accessible name so S4.4's card can read "Dara Byrne, awaiting" rather than a
   *  bare "Awaiting" out of context. Omitted, the visible word is the accessible text. */
  'aria-label'?: string
}

/**
 * The three-state availability pill (S3.2 AC5): "Available", "Unavailable" or "Awaiting". It takes a
 * value, not a hook call, because S4.4's card line one renders it against another player's response
 * (D42); S3.5 does not reuse it — attendance is a different set and ships as `AttendancePill`.
 *
 * Each state carries a distinct glyph as well as a distinct theme token, so the three are separable
 * in greyscale and by anyone who cannot tell the tokens apart (AC5). The glyph is `aria-hidden`; the
 * word is the accessible text.
 */
interface Variant {
  label: string
  icon: LucideIcon
  variant: 'default' | 'destructive' | 'outline'
}

const variants: Record<'available' | 'unavailable' | 'awaiting', Variant> = {
  available: { label: 'Available', icon: Check, variant: 'default' },
  unavailable: { label: 'Unavailable', icon: X, variant: 'destructive' },
  awaiting: { label: 'Awaiting', icon: Minus, variant: 'outline' },
}

export function ResponsePill({
  response,
  'aria-label': ariaLabel,
}: ResponsePillProps): React.JSX.Element {
  const { label, icon: Icon, variant } = variants[response ?? 'awaiting']
  return (
    <Badge variant={variant} aria-label={ariaLabel}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}
