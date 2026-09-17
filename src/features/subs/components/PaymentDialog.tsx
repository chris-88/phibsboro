import { useState } from 'react'
import { X } from 'lucide-react'
import { useDeleteSubsPayment, useRecordSubsPayment } from '@/api/subs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SubsPaymentRow } from '@/features/subs/schema'
import { formatMoney, type SubsRow } from '@/features/subs/subs'
import { formatEventTime } from '@/lib/time'

export interface PaymentDialogProps {
  row: SubsRow
  /** This member's payments (newest first), from the parent's cached read. */
  payments: readonly SubsPaymentRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Record and undo a member's part-payments (Epic 19, Y2). Admin-only in practice — the screen is
 * admin-guarded and RLS refuses a non-admin write. Shows what they owe, an amount box to add a
 * payment, and the list of payments so far, each removable. The list and totals come from the
 * parent's cached read, so a record/undo reflects everywhere on the next invalidation.
 */
export function PaymentDialog({
  row,
  payments,
  open,
  onOpenChange,
}: PaymentDialogProps): React.JSX.Element {
  const record = useRecordSubsPayment()
  const remove = useDeleteSubsPayment()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsed = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  const add = (): void => {
    if (!valid) return
    setError(null)
    record.mutate(
      { userId: row.userId, amount: Math.round(parsed * 100) / 100 },
      {
        onSuccess: () => {
          setAmount('')
        },
        onError: () => {
          setError("Couldn't save that payment. Try again.")
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAmount('')
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>
            {row.outstanding === 0
              ? `Paid up — ${formatMoney(row.paid)} of ${formatMoney(row.amountDue)}.`
              : `${formatMoney(row.paid)} of ${formatMoney(row.amountDue)} paid · ${formatMoney(row.outstanding)} left.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="subs-amount">Record a payment (€)</Label>
            <Input
              id="subs-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              disabled={record.isPending}
              onChange={(e) => {
                setAmount(e.target.value)
              }}
            />
          </div>
          <Button type="button" onClick={add} disabled={!valid || record.isPending}>
            {record.isPending ? 'Saving…' : 'Add'}
          </Button>
        </div>

        {error != null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Payments
          </p>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatMoney(p.amount)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {formatEventTime(p.recorded_at, 'short')}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0"
                    aria-label={`Remove ${formatMoney(p.amount)} payment`}
                    disabled={remove.isPending}
                    onClick={() => {
                      remove.mutate({ id: p.id })
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
