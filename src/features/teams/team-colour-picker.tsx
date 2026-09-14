import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TEAM_PALETTE, teamColourName } from '@/features/teams/palette'
import { cn } from '@/lib/utils'

export interface TeamColourPickerProps {
  /** The team's current colour (hex from the palette). */
  colour: string
  /** For the accessible names on the trigger and options. */
  teamName: string
  disabled?: boolean
  /** Called with the chosen palette value; the parent owns the mutation and error handling. */
  onPick: (colour: string) => void
}

/**
 * The admin-only team-colour swatch picker (S10.1). A trigger showing the current colour opens a
 * grid of the fixed accessible palette (TEAM_PALETTE); picking one calls `onPick`. Lives on the
 * admin `/admin` screen, which is already admin-gated — the picker's presence is convenience;
 * RLS refuses a non-admin write (a zero-row update) regardless (S1.3, S1.4).
 *
 * The colour values are runtime data (per-team, from the DB / the palette constant), never hex
 * literals in this file, so the no-hardcoded-hex rule is satisfied.
 */
export function TeamColourPicker({
  colour,
  teamName,
  disabled,
  onPick,
}: TeamColourPickerProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={`Colour for ${teamName}: ${teamColourName(colour)}`}
        >
          <span
            className="size-4 rounded-full border border-black/10"
            style={{ backgroundColor: colour }}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div
          role="listbox"
          aria-label={`Colour for ${teamName}`}
          className="grid grid-cols-4 gap-1 p-1"
        >
          {TEAM_PALETTE.map((entry) => {
            const selected = entry.value === colour
            return (
              <button
                key={entry.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={entry.name}
                onClick={() => {
                  onPick(entry.value)
                }}
                className={cn(
                  'flex size-tap items-center justify-center rounded-lg border transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  selected ? 'border-ring' : 'border-transparent hover:border-border',
                )}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full border border-black/10"
                  style={{ backgroundColor: entry.value }}
                >
                  {selected && <Check className="size-4 text-white" aria-hidden="true" />}
                </span>
              </button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
