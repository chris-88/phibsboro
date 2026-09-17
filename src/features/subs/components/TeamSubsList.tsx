import { useTeamMembers } from '@/api/members'
import { useClubSettings, useSubsPayments } from '@/api/subs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { buildSubsRows, formatMoney } from '@/features/subs/subs'
import { buildSubsReminderMessage, waMeUrl } from '@/lib/shareMessage'

/**
 * The manager's subs view for their team (Epic 19, S19.4): who's paid and who's behind. Read-only —
 * recording payments is the admin's job (S19.1) — with a WhatsApp "Remind" per player still owing
 * (Y4, the manager half). Reuses the team roster and the RLS-scoped payments read (a manager sees
 * their team's rows). The amount comes from `club_settings`; outstanding is derived.
 */
export function TeamSubsList({ teamId }: { teamId: string }): React.JSX.Element {
  const members = useTeamMembers(teamId)
  const payments = useSubsPayments()
  const settings = useClubSettings()

  if (members.isPending || payments.isPending || settings.isPending) {
    return <LoadingState label="Loading subs" />
  }
  if (members.isError || payments.isError || settings.isError) {
    return (
      <ErrorState
        title="Couldn't load subs."
        onRetry={() => {
          void members.refetch()
          void payments.refetch()
          void settings.refetch()
        }}
      />
    )
  }

  if (settings.data.amount === 0) {
    return <EmptyState title="Subs aren't set up yet." body="An admin sets the amount." />
  }

  const rows = buildSubsRows(
    members.data.map((m) => ({ userId: m.user_id, name: m.name })),
    payments.data,
    settings.data.amount,
  )
  if (rows.length === 0) {
    return <EmptyState title="No members yet." />
  }

  const payLink = settings.data.payLink

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const paidUp = row.outstanding === 0
        return (
          <li key={row.userId}>
            <Card size="sm">
              <CardContent className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {row.name}
                </span>
                <Badge variant={paidUp ? 'secondary' : 'destructive'} className="shrink-0">
                  {paidUp ? 'Paid up' : `${formatMoney(row.outstanding)} left`}
                </Badge>
                {!paidUp && (
                  <Button asChild size="sm" variant="outline" className="min-h-tap shrink-0">
                    <a
                      href={waMeUrl(
                        buildSubsReminderMessage(row.name, formatMoney(row.outstanding), payLink),
                      )}
                      rel="noopener noreferrer"
                      aria-label={`Remind ${row.name} over WhatsApp`}
                    >
                      Remind
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
