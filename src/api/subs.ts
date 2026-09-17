import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { useMemo } from 'react'
import { subsKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import {
  clubSettingsRowSchema,
  subsPaymentRowSchema,
  type SubsPaymentRow,
} from '@/features/subs/schema'
import { mySubs } from '@/features/subs/subs'
import { supabase } from '@/lib/supabase'

/**
 * The subs data layer (Epic 19). One club-wide amount + pay link (`club_settings`, admin-writable,
 * everyone reads) and the part-payments (`subs_payments`, admin-writable; a player reads their own,
 * a manager their teams' members, an admin all — enforced by RLS, so each read returns exactly what
 * the caller may see and the screens filter from there). Writes are direct table calls gated by the
 * admin RLS policy, the same shape as attendance; no RPC needed.
 */

/** The club subs settings the whole app reads. */
export interface ClubSettings {
  amount: number
  payLink: string | null
}

export function useClubSettings(): UseQueryResult<ClubSettings> {
  return useQuery({
    queryKey: subsKeys.settings(),
    queryFn: async (): Promise<ClubSettings> => {
      const { data, error } = await supabase
        .from('club_settings')
        .select('id, subs_amount, pay_link, updated_at')
        .eq('id', true)
        .single()
      if (error) throw error
      const row = clubSettingsRowSchema.parse(data)
      return { amount: row.subs_amount, payLink: row.pay_link }
    },
  })
}

/** Set the club-wide amount and pay link (admin only, enforced by RLS). */
export function useUpdateClubSettings(): UseMutationResult<
  void,
  PostgrestError,
  { amount: number; payLink: string | null }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ amount, payLink }) => {
      const { error } = await supabase
        .from('club_settings')
        .update({ subs_amount: amount, pay_link: payLink })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subsKeys.settings() })
    },
  })
}

/**
 * Every subs payment the caller may read (RLS-scoped): own for a player, their teams' members for a
 * manager, all for an admin. The screens filter to the members they care about and aggregate with
 * `buildSubsRows`. Parsed at the boundary.
 */
export function useSubsPayments(): UseQueryResult<SubsPaymentRow[]> {
  return useQuery({
    queryKey: subsKeys.payments(),
    queryFn: async (): Promise<SubsPaymentRow[]> => {
      const { data, error } = await supabase
        .from('subs_payments')
        .select('id, user_id, amount, note, recorded_by, recorded_at')
        .order('recorded_at', { ascending: false })
      if (error) throw error
      return z.array(subsPaymentRowSchema).parse(data)
    },
  })
}

/** Record a part-payment for a member (admin only). `recorded_by` is the acting admin (audit). */
export function useRecordSubsPayment(): UseMutationResult<
  void,
  PostgrestError,
  { userId: string; amount: number; note?: string | null }
> {
  const qc = useQueryClient()
  const session = useSession()
  const recordedBy = session.status === 'signedIn' ? session.session.user.id : null
  return useMutation({
    mutationFn: async ({ userId, amount, note }) => {
      const { error } = await supabase.from('subs_payments').insert({
        user_id: userId,
        amount,
        note: note ?? null,
        recorded_by: recordedBy,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subsKeys.payments() })
    },
  })
}

/** Undo a recorded payment (admin only). */
export function useDeleteSubsPayment(): UseMutationResult<void, PostgrestError, { id: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('subs_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subsKeys.payments() })
    },
  })
}

/** The signed-in user's own subs (Epic 19), composed from the club amount + their own payments (which
 *  is all a plain player's `useSubsPayments` returns anyway). For the profile card and the reminder
 *  modal. `null` amount means subs aren't set up; the callers hide themselves then. */
export interface MySubs {
  amountDue: number
  paid: number
  outstanding: number
  payLink: string | null
}

export function useMySubs(): { data: MySubs | undefined; isPending: boolean; isError: boolean } {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  const settings = useClubSettings()
  const payments = useSubsPayments()

  const data = useMemo<MySubs | undefined>(() => {
    if (!settings.data || !payments.data || userId === undefined) return undefined
    const own = payments.data.filter((p) => p.user_id === userId)
    return { ...mySubs(own, settings.data.amount), payLink: settings.data.payLink }
  }, [settings.data, payments.data, userId])

  return {
    data,
    isPending: settings.isPending || payments.isPending,
    isError: settings.isError || payments.isError,
  }
}
