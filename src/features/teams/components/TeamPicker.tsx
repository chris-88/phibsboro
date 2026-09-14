import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select'
import type { Team } from '@/features/teams/schema'

export interface TeamPickerProps {
  /** Already ordered active-first then by name by `useManagedTeams`; this only splits the two. */
  teams: readonly Team[]
  teamId: string
  onChange: (teamId: string) => void
}

/**
 * The manage-area team picker (S6.3). A shadcn `Select` on every width — one tap, a native-feeling
 * sheet on iOS, no custom dismissal. Active teams first, then a labelled "Inactive" group; each
 * inactive row and the trigger itself carry an "Inactive" badge, so an admin is never quietly
 * editing a retired team. The trigger truncates rather than wrapping the header (AC12).
 */
export function TeamPicker({ teams, teamId, onChange }: TeamPickerProps): React.JSX.Element {
  const active = teams.filter((t) => t.active)
  const inactive = teams.filter((t) => !t.active)
  const current = teams.find((t) => t.id === teamId) ?? null

  return (
    <Select value={teamId} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label="Team">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{current?.name}</span>
          {current !== null && !current.active && (
            <Badge variant="secondary" className="shrink-0">
              Inactive
            </Badge>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {active.length > 0 && (
          <SelectGroup>
            {active.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="truncate">{t.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {inactive.length > 0 && (
          <SelectGroup>
            <SelectLabel>Inactive</SelectLabel>
            {inactive.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="truncate">{t.name}</span>
                <Badge variant="secondary" className="shrink-0">
                  Inactive
                </Badge>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
