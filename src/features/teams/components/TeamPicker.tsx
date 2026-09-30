import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Team } from '@/features/teams/schema'

export interface TeamPickerProps {
  /** Already ordered active-first then by name by `useManagedTeams`; rendered in that order. */
  teams: readonly Team[]
  teamId: string
  onChange: (teamId: string) => void
}

/**
 * The manage-area team switcher (S6.3; S20.1). Inline pills on a shadcn `ToggleGroup`, not a
 * dropdown: the Radix `Select` it replaced did not open reliably in the iOS PWA / WhatsApp in-app
 * browser, so a multi-team admin could not switch team from the Schedule or Squad header (Chris,
 * 2026-09-30). `ToggleGroup` is the exact control the Squad tab's view switch uses — proven to work
 * on the same screen — and one tap beats a dropdown on a phone. Active teams come first (the caller
 * pre-sorts), each inactive pill badged so an admin is never quietly editing a retired team. Wraps
 * on a narrow screen; every pill carries the 44px floor from `toggleVariants` (A16).
 */
export function TeamPicker({ teams, teamId, onChange }: TeamPickerProps): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      value={teamId}
      onValueChange={(v) => {
        // Radix hands back '' when the current pill is tapped again; ignore it so a team stays
        // selected (mirrors the Squad view switch, S17.2).
        if (v) onChange(v)
      }}
      aria-label="Team"
      className="w-full flex-wrap"
    >
      {teams.map((t) => (
        <ToggleGroupItem key={t.id} value={t.id} variant="outline" className="min-w-0 flex-1 gap-1.5">
          <span className="truncate">{t.name}</span>
          {!t.active && (
            <Badge variant="secondary" className="shrink-0">
              Inactive
            </Badge>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
