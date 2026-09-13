import type { Fn, FnName } from '@/lib/db'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * Every RPC call goes through here. `fn` and `args` are typed from the generated
 * `Database['public']['Functions']`, so a wrong argument name or a misspelt function is a
 * typecheck error (S1.5 AC8); a database refusal becomes an `AppError` carrying one of the six
 * codes or `unknown` (AC9).
 *
 * A lookup RPC that "fails" returns an empty array, never an error (S1.3). Callers treat `[]`
 * as not-found and never promote it to a throw: the difference between "unknown" and "expired"
 * is deliberately unavailable so tokens cannot be probed.
 */
export async function callRpc<K extends FnName>(
  fn: K,
  args: Fn<K>['Args'],
): Promise<Fn<K>['Returns']> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toAppError(error)
  return data
}
