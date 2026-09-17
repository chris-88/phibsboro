import { useMySubs } from '@/api/subs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/features/subs/subs'

/**
 * The signed-in member's own subs on their profile (Epic 19, S19.2): what they owe, what they've
 * paid, and a Pay button to the admin-set link. Renders nothing while loading, on error, or when
 * subs aren't set up (amount 0) — the profile never blocks on it.
 */
export function SubsCard(): React.JSX.Element | null {
  const subs = useMySubs()
  if (!subs.data || subs.data.amountDue === 0) return null
  const { amountDue, paid, outstanding, payLink } = subs.data

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Subs</h2>
      <Card>
        <CardContent className="flex flex-col gap-3">
          {outstanding === 0 ? (
            <p className="text-sm text-foreground">
              You&apos;re paid up — {formatMoney(paid)} of {formatMoney(amountDue)}.
            </p>
          ) : (
            <>
              <p className="text-sm text-foreground">
                <span className="font-semibold">{formatMoney(outstanding)}</span> left
                <span className="text-muted-foreground">
                  {' '}
                  · {formatMoney(paid)} of {formatMoney(amountDue)} paid
                </span>
              </p>
              {payLink !== null ? (
                <Button asChild className="w-full">
                  <a href={payLink} target="_blank" rel="noopener noreferrer">
                    Pay now
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Ask your manager how to pay.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
