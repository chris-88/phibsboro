import { describe, expect, it } from 'vitest'
import {
  type BreadcrumbLike,
  PHONE_MASK,
  type SentryEventLike,
  TOKEN_MASK,
  scrubBreadcrumb,
  scrubDeep,
  scrubEvent,
  scrubString,
} from '@/lib/sentry-scrub'

// One case per format the app will actually see (AC7). Each runs through every surface the
// event carries text on, so a pattern that works in a message but not a URL cannot pass.
const PHONES: [name: string, raw: string][] = [
  ['E.164', '+353871234567'],
  ['E.164 with spaces', '+353 87 123 4567'],
  ['Irish national with spaces', '087 123 4567'],
  ['Irish national', '0871234567'],
  ['in a query string', 'https://x.supabase.co/auth/v1/otp?phone=%2B353871234567&x=1'],
  ['as Supabase Auth stores it, no plus', '353871234567'],
]

function eventCarrying(text: string): SentryEventLike {
  return {
    message: `msg ${text}`,
    transaction: `txn ${text}`,
    exception: { values: [{ type: 'Error', value: `exc ${text}` }] },
    request: {
      url: `https://app.phibsboro.ie/#/login?phone=${text}`,
      data: JSON.stringify({ phone: text, password: 'hunter22' }),
      headers: { 'x-phone': text },
    },
    breadcrumbs: [{ category: 'console', message: `crumb ${text}`, data: { args: [text] } }],
    extra: { nested: { deeper: { phone: text } } },
    tags: { phone: text },
    contexts: { form: { phone: text } },
  }
}

function everyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => everyString(v, out))
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => everyString(v, out))
  return out
}

// The subscriber part every fixture above ends in. Its absence is the proof.
const DIGITS = '1234567'

describe('scrubString phone patterns (AC7)', () => {
  it.each(PHONES)('masks %s', (_name, raw) => {
    expect(scrubString(raw)).toContain(PHONE_MASK)
    expect(scrubString(raw)).not.toContain(DIGITS)
  })

  it('masks the number everywhere on an event, not only in the message', () => {
    for (const [, raw] of PHONES) {
      const strings = everyString(scrubEvent(eventCarrying(raw)))
      expect(strings.length).toBeGreaterThan(8)
      for (const s of strings) expect(s).not.toContain(DIGITS)
    }
  })

  it('leaves short numbers, ports and status codes alone', () => {
    expect(scrubString('HTTP 404 on port 54321 after 1500ms, row 12')).toBe(
      'HTTP 404 on port 54321 after 1500ms, row 12',
    )
  })
})

describe('scrubString token truncation (AC8)', () => {
  const token = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3z'

  it('truncates a join token inside a full URL', () => {
    expect(scrubString(`https://app.phibsboro.ie/#/join/${token}`)).toBe(
      `https://app.phibsboro.ie/#/join/${TOKEN_MASK}`,
    )
  })

  it('truncates a reset token inside a full URL and keeps what follows a ?', () => {
    expect(scrubString(`https://app.phibsboro.ie/#/reset/${token}?src=wa`)).toBe(
      `https://app.phibsboro.ie/#/reset/${TOKEN_MASK}?src=wa`,
    )
  })

  it('truncates a token inside a transaction name', () => {
    const scrubbed = scrubEvent({ transaction: `/#/join/${token}` })
    expect(scrubbed.transaction).toBe(`/#/join/${TOKEN_MASK}`)
  })

  it('truncates a token from a request URL and a breadcrumb', () => {
    const scrubbed = scrubEvent({
      request: { url: `https://app.phibsboro.ie/#/reset/${token}` },
      breadcrumbs: [{ category: 'navigation', data: { to: `/#/join/${token}` } }],
    })
    expect(scrubbed.request.url).toBe(`https://app.phibsboro.ie/#/reset/${TOKEN_MASK}`)
    expect(scrubbed.breadcrumbs[0]?.data.to).toBe(`/#/join/${TOKEN_MASK}`)
  })

  it('applies the token rule before the phone rules, so a numeric token is one mask', () => {
    expect(scrubString('/#/join/353871234567')).toBe(`/#/join/${TOKEN_MASK}`)
  })

  it('leaves an event path alone', () => {
    expect(scrubString('/#/event/8f1c2a7e-1')).toBe('/#/event/8f1c2a7e-1')
  })
})

describe('scrubString does not over-redact (S7.2 AC6, D16)', () => {
  // The failure nobody notices until an issue is unreadable: a pattern eating the identifiers that
  // make an error traceable. Each is asserted with toBe(input), not merely "no mask".
  const EVENT_UUID = '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f'

  it('leaves an event uuid whole', () => {
    expect(scrubString(EVENT_UUID)).toBe(EVENT_UUID)
  })

  it('leaves the /#/event/{uuid} path whole — it is how an issue is traced back to an event', () => {
    const path = `/#/event/${EVENT_UUID}`
    expect(scrubString(path)).toBe(path)
    // The event route is not a token route: unlike /#/join and /#/reset it is not truncated.
    expect(scrubString(`https://app.phibsboro.ie${path}`)).toBe(`https://app.phibsboro.ie${path}`)
  })

  it('leaves a Postgres error code whole', () => {
    expect(scrubString('PGRST116')).toBe('PGRST116')
  })

  it('masks a bare 13-digit run — the err-wide BARE_DIGITS rule, a documented false positive (S7.2 deviation)', () => {
    // AC6 asks that a 13-digit millisecond timestamp such as 1774000000000 survive whole. The
    // scrubber deliberately masks any bare 9–15 digit run (D16: "every pattern errs wide"), because
    // a bare Supabase-stored phone (353871234567) is 12 digits and 00353… is 14, and a false
    // negative is an unrecoverable leak while a false positive costs one digit run in a report.
    // Preserving the timestamp would mean narrowing a security pattern owned by S0.6, so the
    // behaviour is left as designed and pinned here rather than changed. See the build notes.
    expect(scrubString('1774000000000')).toBe(PHONE_MASK)
  })
})

describe('scrubEvent and scrubBreadcrumb do not mutate their input (S7.2 AC6)', () => {
  // Sentry reuses the event object, so a scrubber that edited in place would corrupt the caller's
  // copy. Deep-equality against a clone taken before the call is the proof.
  it('scrubEvent returns a scrubbed copy and leaves the argument untouched', () => {
    const event = eventCarrying('+353871234567')
    const before = structuredClone(event)
    const out = scrubEvent(event)
    expect(event).toStrictEqual(before)
    // And it actually scrubbed the copy, so the non-mutation is not a no-op.
    expect(everyString(out).join(' ')).not.toContain(DIGITS)
  })

  it('scrubBreadcrumb returns a scrubbed copy and leaves the argument untouched', () => {
    const crumb: BreadcrumbLike = {
      category: 'ui.click',
      message: 'tap 0871234567',
      data: { form: { fields: { phone: '+353871234567' }, list: ['087 123 4567'] } },
    }
    const before = structuredClone(crumb)
    const out = scrubBreadcrumb(crumb)
    expect(crumb).toStrictEqual(before)
    expect(out.message).toBe(`tap ${PHONE_MASK}`)
  })
})

describe('scrubBreadcrumb', () => {
  it('scrubs a nested data object', () => {
    const crumb: BreadcrumbLike = {
      category: 'ui.click',
      message: 'tap 0871234567',
      data: { form: { fields: { phone: '+353871234567' }, list: ['087 123 4567'] } },
    }
    const out = scrubBreadcrumb(crumb)
    expect(out.message).toBe(`tap ${PHONE_MASK}`)
    expect(out.data).toEqual({ form: { fields: { phone: PHONE_MASK }, list: [PHONE_MASK] } })
    // Pure: the input is untouched.
    expect(crumb.data?.form).toEqual({
      fields: { phone: '+353871234567' },
      list: ['087 123 4567'],
    })
  })

  it('reduces an /auth/v1/ fetch crumb to method and status', () => {
    const out = scrubBreadcrumb({
      category: 'fetch',
      type: 'http',
      data: {
        method: 'POST',
        status_code: 400,
        url: 'https://x.supabase.co/auth/v1/token?grant_type=password',
        request_body_size: 88,
      },
    })
    expect(out.data).toEqual({ method: 'POST', status_code: 400 })
    expect(out.category).toBe('fetch')
  })

  it('reduces an /auth/v1/ xhr crumb the same way', () => {
    const out = scrubBreadcrumb({
      category: 'xhr',
      data: { method: 'GET', url: 'https://x.supabase.co/auth/v1/user', status_code: 200 },
    })
    expect(out.data).toEqual({ method: 'GET', status_code: 200 })
  })

  it('keeps the full data of a non-auth fetch crumb, scrubbed', () => {
    const out = scrubBreadcrumb({
      category: 'fetch',
      data: {
        method: 'GET',
        url: 'https://x.supabase.co/rest/v1/events?phone=eq.0871234567',
        status_code: 200,
      },
    })
    expect(out.data).toEqual({
      method: 'GET',
      url: `https://x.supabase.co/rest/v1/events?phone=eq.${PHONE_MASK}`,
      status_code: 200,
    })
  })
})

describe('scrubEvent user and shape', () => {
  it('reduces user to { id } whatever set it (AC10)', () => {
    const scrubbed = scrubEvent({
      user: {
        id: 'abc',
        email: 'x@example.com',
        username: '0871234567',
        ip_address: '1.2.3.4',
      } as SentryEventLike['user'],
    })
    expect(scrubbed.user).toEqual({ id: 'abc' })
  })

  it('leaves an id-less user empty rather than inventing one', () => {
    expect(
      scrubEvent({ user: { email: 'x@example.com' } as SentryEventLike['user'] }).user,
    ).toEqual({})
  })

  it('preserves exception type, structure and frames so Sentry still groups (AC11)', () => {
    const frames = [
      { filename: 'src/features/events/event-screen.tsx', function: 'EventScreen', lineno: 42 },
      { filename: 'src/App.tsx', function: 'App', lineno: 9 },
    ]
    const event = {
      event_id: 'e1',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'cannot read 0871234567',
            mechanism: { type: 'generic', handled: true },
            stacktrace: { frames },
          },
        ],
      },
    }
    const scrubbed = scrubEvent(event)
    const first = scrubbed.exception.values[0]
    expect(first?.type).toBe('TypeError')
    expect(first?.value).toBe(`cannot read ${PHONE_MASK}`)
    expect(first?.mechanism).toEqual({ type: 'generic', handled: true })
    expect(first?.stacktrace.frames).toEqual(frames)
    expect(first?.stacktrace.frames.length).toBeGreaterThan(0)
    expect(scrubbed.event_id).toBe('e1')
  })

  it('never returns null, even for an empty event', () => {
    expect(scrubEvent({})).toEqual({})
    expect(scrubBreadcrumb({})).toEqual({})
  })
})

describe('scrubDeep terminates (AC12)', () => {
  it('survives a self-referential object', () => {
    const cyclic: Record<string, unknown> = { phone: '0871234567' }
    cyclic.self = cyclic
    cyclic.list = [cyclic, '087 123 4567']
    const out = scrubDeep(cyclic)
    expect(out.phone).toBe(PHONE_MASK)
    expect((out.list as unknown[])[1]).toBe(PHONE_MASK)
  })

  it('caps depth at 8 and leaves what is below untouched', () => {
    let leaf: Record<string, unknown> = { phone: '0871234567' }
    const deepLeaf = leaf
    for (let i = 0; i < 20; i++) leaf = { child: leaf }
    const out = scrubDeep(leaf)
    let cursor: unknown = out
    for (let i = 0; i < 8; i++) cursor = (cursor as Record<string, unknown>).child
    // Depth 8 is where the walk stops: the same object comes back by reference.
    expect(cursor).toBeDefined()
    expect(deepLeaf.phone).toBe('0871234567')
  })

  it('leaves non-plain objects alone', () => {
    const date = new Date(0)
    const error = new Error('0871234567')
    const out = scrubDeep({ date, error, n: 353871234567 })
    expect(out.date).toBe(date)
    expect(out.error).toBe(error)
    expect(out.n).toBe(353871234567)
  })
})
