import { useEffect, useState } from 'react'
import { responseWindow, type ResponseWindow } from '@/features/availability/response-window'
import type { Enums } from '@/lib/db'
import { serverNow } from '@/lib/serverClock'

type EventStatus = Enums<'event_status'>

/** Six hours: beyond it the app has been backgrounded and S3.3's refetch-on-focus re-arms this
 *  with a fresh skew, so arming a long timer in a webview that will be killed inside a minute buys
 *  nothing (S3.4 open question 3). */
const CLAMP_MS = 6 * 60 * 60 * 1000

/**
 * `responseWindow(event, serverNow())` on every render, so a wrong device clock shifts nothing
 * (D48, AC7): `serverNow()` is `Date.now()` plus the skew captured from PostgREST's `Date` header,
 * owned by S3.3's `serverClock`. No polling. One `setTimeout` armed at kick-off (when it is inside
 * the six-hour clamp) bumps a counter, and that re-render re-reads `serverNow()` — now past
 * `starts_at` — so the window flips on screen with no reload and no tap (AC8). The elapsed interval
 * is measured by the timer, never by re-reading a wall clock.
 */
export function useResponseWindow(event: {
  status: EventStatus
  starts_at: string
}): ResponseWindow {
  const [, bump] = useState(0)

  useEffect(() => {
    if (event.status === 'cancelled') return
    // +1000 so the timer lands a second past the boundary, safely on the shut side of the `<=`.
    const delta = Date.parse(event.starts_at) - serverNow().getTime() + 1000
    if (delta <= 0 || delta > CLAMP_MS) return
    const id = setTimeout(() => {
      bump((n) => n + 1)
    }, delta)
    return () => {
      clearTimeout(id)
    }
  }, [event.starts_at, event.status])

  return responseWindow(event, serverNow())
}
