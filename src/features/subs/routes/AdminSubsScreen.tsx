import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useAllUsers } from '@/api/admin-users'
import {
  useClubSettings,
  useSubsPayments,
  useUpdateClubSettings,
  type ClubSettings,
} from '@/api/subs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { PaymentDialog } from '@/features/subs/components/PaymentDialog'
import type { SubsPaymentRow } from '@/features/subs/schema'
import { buildSubsRows, formatMoney, summariseSubs, type SubsRow } from '@/features/subs/subs'
import { paths } from '@/lib/paths'

/**
 * The admin subs desk `/admin/subs` (Epic 19). Set the club-wide amount and pay link (Y1); see the
 * full membership with what each owes and has paid, and a summary of what's collected vs outstanding;
 * record and undo part-payments (Y2). Admin-guarded (route + inline gate); RLS is the boundary.
 */
export default function AdminSubsScreen(): React.JSX.Element {
  const account = useCurrentUser()
  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  if (account.status !== 'ready' || !account.user.isAdmin) {
    return <Navigate to={paths.home()} replace />
  }
  return <Subs />
}

function Subs(): React.JSX.Element {
  const settings = useClubSettings()
  const users = useAllUsers()
  const payments = useSubsPayments()

  const rows = useMemo<SubsRow[] | null>(() => {
    if (!settings.data || !users.data || !payments.data) return null
    const members = users.data
      .filter((u) => u.memberships.length > 0)
      .map((u) => ({ userId: u.id, name: u.name }))
    return buildSubsRows(members, payments.data, settings.data.amount)
  }, [settings.data, users.data, payments.data])

  const failed = settings.isError || users.isError || payments.isError

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="px-1 text-lg font-semibold text-foreground">Subs</h1>

      {settings.data ? (
        <SettingsForm initial={settings.data} />
      ) : settings.isError ? (
        <ErrorState title="Couldn't load settings." onRetry={() => void settings.refetch()} />
      ) : (
        <LoadingState rows={1} label="Loading settings" />
      )}

      {failed ? (
        <ErrorState
          title="Couldn't load subs."
          onRetry={() => {
            void users.refetch()
            void payments.refetch()
          }}
        />
      ) : rows === null ? (
        <LoadingState rows={4} label="Loading subs" />
      ) : rows.length === 0 ? (
        <EmptyState title="No members yet." body="Add players and managers to a team first." />
      ) : (
        <>
          <SummaryCard rows={rows} />
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.userId}>
                <MemberCard
                  row={row}
                  payments={(payments.data ?? []).filter((p) => p.user_id === row.userId)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** The club-wide amount + pay link. Rendered only once settings have loaded, so the inputs seed from
 *  the loaded values without an effect. */
function SettingsForm({ initial }: { initial: ClubSettings }): React.JSX.Element {
  const update = useUpdateClubSettings()
  const [amount, setAmount] = useState(String(initial.amount))
  const [link, setLink] = useState(initial.payLink ?? '')
  const [saved, setSaved] = useState(false)

  const parsed = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 0

  const save = (): void => {
    if (!valid) return
    setSaved(false)
    update.mutate(
      { amount: Math.round(parsed * 100) / 100, payLink: link.trim() === '' ? null : link.trim() },
      {
        onSuccess: () => {
          setSaved(true)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Subs settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="club-amount">Amount everyone owes (€)</Label>
          <Input
            id="club-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setSaved(false)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="club-link">Payment link</Label>
          <Input
            id="club-link"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="https://…"
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setSaved(false)
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={!valid || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
          {update.isError && <span className="text-sm text-destructive">Didn't save.</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCard({ rows }: { rows: readonly SubsRow[] }): React.JSX.Element {
  const s = summariseSubs(rows)
  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Collected" value={formatMoney(s.totalPaid)} />
        <Stat label="Outstanding" value={formatMoney(s.totalOutstanding)} />
        <Stat label="Paid up" value={`${String(s.paidUp)}/${String(s.members)}`} />
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-base font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function MemberCard({
  row,
  payments,
}: {
  row: SubsRow
  payments: readonly SubsPaymentRow[]
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const paidUp = row.outstanding === 0
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatMoney(row.paid)} of {formatMoney(row.amountDue)}
          </span>
        </span>
        <Badge variant={paidUp ? 'secondary' : 'destructive'} className="shrink-0">
          {paidUp ? 'Paid up' : `${formatMoney(row.outstanding)} left`}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            setOpen(true)
          }}
        >
          Payments
        </Button>
      </CardContent>
      <PaymentDialog row={row} payments={payments} open={open} onOpenChange={setOpen} />
    </Card>
  )
}
