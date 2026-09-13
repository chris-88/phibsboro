import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordServerDate, serverNow } from '@/lib/serverClock'

// A device clock we control, with zero milliseconds so an HTTP-date round trip is exact.
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  // Reset the module's skew to a known zero: the server agrees with the device.
  recordServerDate(new Date(NOW).toUTCString())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('serverClock (D48)', () => {
  it('a header 90 seconds ahead moves serverNow() by 90 seconds', () => {
    recordServerDate(new Date(NOW + 90_000).toUTCString())
    expect(serverNow().getTime()).toBe(NOW + 90_000)
  })

  it('a header 90 seconds behind moves serverNow() back by 90 seconds', () => {
    recordServerDate(new Date(NOW - 90_000).toUTCString())
    expect(serverNow().getTime()).toBe(NOW - 90_000)
  })

  it('a missing header leaves the skew untouched', () => {
    recordServerDate(new Date(NOW + 90_000).toUTCString())
    recordServerDate(null)
    expect(serverNow().getTime()).toBe(NOW + 90_000)
  })

  it('an unparseable header leaves the skew untouched', () => {
    recordServerDate(new Date(NOW + 90_000).toUTCString())
    recordServerDate('not a date')
    expect(serverNow().getTime()).toBe(NOW + 90_000)
  })

  it('with the server in step, serverNow() is the device clock', () => {
    expect(serverNow().getTime()).toBe(NOW)
  })
})
