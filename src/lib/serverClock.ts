/**
 * The cut-off on a response is a server rule (D12, D48): a phone with a wrong clock must not be
 * able to answer a started event, nor be locked out of an unstarted one. No new round trip is
 * needed — every PostgREST response carries a `Date` header — so the client's `fetch` records the
 * skew between server and device (src/lib/supabase.ts) and everything that needs "now" for a
 * cut-off reads it here.
 *
 * `skewMs` starts at zero, so before the first response `serverNow()` is the device clock. That is
 * fine: nothing decides a cut-off before the first response has arrived. Both functions are pure
 * over the injected `Date.now()`, so a test can drive them with a fake header and a fake clock.
 */
let skewMs = 0

/** Records the offset from a response's `Date` header. A missing or unparseable header is
 *  ignored, leaving the last good skew — or zero — in place. */
export function recordServerDate(header: string | null): void {
  if (header === null) return
  const t = Date.parse(header)
  if (Number.isNaN(t)) return
  skewMs = t - Date.now()
}

/** The server's best-known current time, the device clock shifted by the last recorded skew. */
export function serverNow(): Date {
  return new Date(Date.now() + skewMs)
}
