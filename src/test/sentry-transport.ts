import { createTransport } from '@sentry/react'
import type { BrowserOptions } from '@sentry/react'

/**
 * A transport that keeps every envelope in memory and sends nothing anywhere. Tests point the
 * real `initSentry` at it, so the integrations, the scrubber and the boundary all run as they
 * would in production while the network stays silent.
 */
export function fakeSentryTransport(): {
  transport: NonNullable<BrowserOptions['transport']>
  /** Decoded envelope bodies, one per request. */
  bodies: string[]
  /** Error events sent so far, parsed from the envelopes. Sessions are not counted. */
  events: () => Record<string, unknown>[]
} {
  const bodies: string[] = []
  return {
    bodies,
    transport: (options) =>
      createTransport(options, (request) => {
        bodies.push(
          typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
        )
        return Promise.resolve({ statusCode: 200 })
      }),
    events: () => {
      const out: Record<string, unknown>[] = []
      for (const body of bodies) {
        // An envelope is newline-delimited: header, then item header / item payload pairs.
        const lines = body.split('\n')
        for (let i = 1; i + 1 < lines.length; i += 2) {
          const header = JSON.parse(lines[i] ?? '{}') as { type?: string }
          if (header.type === 'event') {
            out.push(JSON.parse(lines[i + 1] ?? '{}') as Record<string, unknown>)
          }
        }
      }
      return out
    },
  }
}

/** Any well-formed DSN will do; the fake transport means it is never contacted. */
export const FAKE_DSN = 'https://publickey@o0.ingest.sentry.io/0'
