import { describe, expect, it } from 'vitest'
import { sentryOptions } from '@/lib/sentry'
import { scrubEvent, type SentryEventLike } from '@/lib/sentry-scrub'

/**
 * S7.1 AC8. Not the scrubber's own coverage (that is S7.2 / sentry-scrub.test.ts) — only the
 * wiring: an unhandled promise rejection travels through `beforeSend`, `beforeSend` is the D16
 * scrubber, and it never drops the event, so a rejection whose message and value carry an E.164
 * number leaves redacted. No Sentry init, no network.
 */
describe('Sentry unhandled-rejection wiring (AC8)', () => {
  it("beforeSend is the D16 scrubber and doesn't filter the event out", () => {
    expect(sentryOptions.beforeSend).toBe(scrubEvent)
    // No `integrations` override, so @sentry/react's defaults stand — its global handlers capture
    // window `unhandledrejection` (onunhandledrejection: true) without a second listener (D16 note).
    expect(sentryOptions.integrations).toBeUndefined()
  })

  it('redacts an E.164 number from a rejection event before it leaves', () => {
    const rejection: SentryEventLike = {
      message: 'Unhandled promise rejection: request failed for +353871234567',
      exception: {
        values: [
          {
            type: 'UnhandledRejection',
            value: 'Non-Error promise rejection captured with value +353871234567',
          },
        ],
      },
    }

    const scrubbed = scrubEvent(rejection)

    expect(JSON.stringify(scrubbed)).not.toContain('+353871234567')
    expect(scrubbed.message).toContain('[phone]')
    expect(scrubbed.exception?.values?.[0]?.value).toContain('[phone]')
  })
})
