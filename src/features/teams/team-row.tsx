import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRenameTeam, useSetTeamActive } from '@/api/teams'
import { DeactivateTeamDialog } from '@/features/teams/deactivate-team-dialog'
import { useManageStore } from '@/features/teams/manageStore'
import { teamNameSchema, type Team } from '@/features/teams/schema'
import { isUniqueViolation } from '@/lib/errors'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'

export interface TeamRowProps {
  team: Team
}

/**
 * One team, one line: the name (tap to rename) on the left, a single Deactivate or Reactivate
 * action on the right (S6.1). Rename validates and maps a duplicate exactly as the create form
 * does; Escape restores the previous name and sends nothing (AC5). Rename and the active toggle
 * are optimistic in the hook; a failure reverts and shows an inline message with Retry (AC12).
 */
export function TeamRow({ team }: TeamRowProps): React.JSX.Element {
  const rename = useRenameTeam()
  const setActive = useSetTeamActive()
  const navigate = useNavigate()
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)
  const busy = rename.isPending || setActive.isPending

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(team.name)
  const [rowError, setRowError] = useState<string | null>(null)
  const [retry, setRetry] = useState<(() => void) | null>(null)
  // Mirrors `editing` for the blur handler, which fires after a state change has been queued.
  const editingRef = useRef(false)

  function beginEdit(): void {
    setDraft(team.name)
    setRowError(null)
    setRetry(null)
    editingRef.current = true
    setEditing(true)
  }

  function stopEdit(): void {
    editingRef.current = false
    setEditing(false)
  }

  function cancelEdit(): void {
    stopEdit()
    setRowError(null)
  }

  function runRename(name: string): void {
    setRowError(null)
    setRetry(null)
    rename.mutate(
      { id: team.id, name },
      {
        onSuccess: () => {
          setRowError(null)
        },
        onError: (error) => {
          if (isUniqueViolation(error, 'teams_name_key')) {
            setRowError("There's already a team called that.")
            setDraft(name)
            editingRef.current = true
            setEditing(true)
          } else {
            setRowError("Couldn't save that.")
            setRetry(() => () => {
              runRename(name)
            })
          }
        },
      },
    )
  }

  function commit(): void {
    const parsed = teamNameSchema.safeParse(draft)
    if (!parsed.success) {
      setRowError(parsed.error.issues[0]?.message ?? 'Give the team a name.')
      return
    }
    const name = parsed.data
    if (name === team.name) {
      cancelEdit()
      return
    }
    stopEdit()
    runRename(name)
  }

  function runSetActive(active: boolean): void {
    setRowError(null)
    setRetry(null)
    setActive.mutate(
      { id: team.id, active },
      {
        onSuccess: () => {
          setRowError(null)
        },
        onError: () => {
          setRowError("Couldn't save that.")
          setRetry(() => () => {
            runSetActive(active)
          })
        },
      },
    )
  }

  return (
    <li className={cn('flex flex-col gap-1 rounded-lg px-1 py-1', busy && 'opacity-50')}>
      <div className="flex items-center gap-2">
        {editing ? (
          <Input
            aria-label={`Rename ${team.name}`}
            value={draft}
            autoFocus
            disabled={busy}
            aria-invalid={rowError ? true : undefined}
            onChange={(e) => {
              setDraft(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
            onBlur={() => {
              if (editingRef.current) commit()
            }}
          />
        ) : (
          <Button
            variant="ghost"
            disabled={busy}
            className="min-w-0 flex-1 justify-start gap-2 font-normal"
            onClick={beginEdit}
          >
            <span className="truncate">{team.name}</span>
            {!team.active && <Badge variant="secondary">Inactive</Badge>}
          </Button>
        )}

        {/* S6.3 AC1: open this team's manage view — set the selection and go to /manage, no URL
            typing. Beside S6.2 AC15's Members link, which reaches the join-link screen. */}
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setSelectedTeamId(team.id)
              void navigate(paths.manage())
            }}
          >
            Manage
          </Button>
        )}

        {!editing && (
          <Button asChild variant="outline" size="sm" disabled={busy}>
            <Link to={paths.teamMembers(team.id)}>Members</Link>
          </Button>
        )}

        {!editing &&
          (team.active ? (
            <DeactivateTeamDialog
              team={team}
              disabled={busy}
              onConfirm={() => {
                runSetActive(false)
              }}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                runSetActive(true)
              }}
            >
              Reactivate
            </Button>
          ))}
      </div>

      {rowError && (
        <div role="alert" className="flex items-center gap-2 pl-1 text-sm text-destructive">
          <span>{rowError}</span>
          {retry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                retry()
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
