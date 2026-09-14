# Cross-cutting unit tests (S7.2)

A map, not a report. Every function the whole product silently depends on — what time an event says
it is, what the WhatsApp message says, how many players are counted as awaiting, and what leaves for
Sentry — is a pure function in `src/lib/`, tested with no database, no browser and no network. The
suite runs under `TZ=UTC` (D53) and every date assertion is a fixed UTC instant.

D57 narrows Epic 7's remit: each feature story already ships its own tests, so this story adds only
the **cross-cutting cases nobody owns** and locks in a coverage floor so they cannot rot.

## The cross-cutting cases this story owns

| Concern                                                       | File                                     | Decision |
| ------------------------------------------------------------- | ---------------------------------------- | -------- |
| Runner clock really is UTC (`TZ`, zero offset)                | `src/lib/__tests__/time.test.ts`         | D53      |
| `formatEventTime` DST + boundary table, asserted literally    | `src/lib/__tests__/time.test.ts`         | D35, D53 |
| The repeated October hour renders identically both passes     | `src/lib/__tests__/time.test.ts`         | D53      |
| `toE164` accepted/rejected table + idempotence over all       | `src/lib/__tests__/phone.test.ts`        | D35      |
| `deriveCounts` empty squad, orphaned row, double response     | `src/lib/counts.test.ts`                 | D22, D33 |
| Scrubber does **not** over-redact (uuid, event path, PG code) | `src/lib/__tests__/sentry-scrub.test.ts` | D16      |
| Scrubber does not mutate the event / breadcrumb it is given   | `src/lib/__tests__/sentry-scrub.test.ts` | D16      |
| `waMeUrl` percent-encoding, `%0A` per newline, round-trip     | `src/lib/shareMessage.test.ts`           | D52      |
| One share message crossing the spring-forward boundary        | `src/lib/shareMessage.test.ts`           | D13, D35 |
| `chunk-reload` default `window.location.reload` fallback      | `src/lib/__tests__/chunk-reload.test.ts` | —        |

## Tests owned elsewhere, confirmed present and green

This story does not duplicate what a feature story already tests. These are asserted to exist:

| What it proves                                      | File                                                                                     | Decision |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Session longevity / silent refresh is pinned config | `src/features/auth/__tests__/session-config.test.ts`                                     | D59      |
| Share message byte-for-byte format                  | `src/lib/shareMessage.test.ts`                                                           | D13      |
| Reminder line differs and names no one              | `src/lib/shareMessage.test.ts`                                                           | D13      |
| Recurring-training horizon is capped (1..16 weeks)  | `src/lib/series.test.ts`, `src/features/events/__tests__/training-series-schema.test.ts` | D30      |

## The coverage floor (AC9)

`vitest.config.ts` enables the v8 provider over `src/lib/**/*.ts` only, with thresholds lines 95,
statements 95, branches 90, functions 100. Excluded: `database.types.ts` (generated), `supabase.ts`
(a client constructor with nothing to assert), `env.ts` (the one module allowed to read
`import.meta.env`), and — an S7.2 deviation — `auth.ts`, whose two live functions are thin
`supabase.auth.*` wrappers testable only by stubbing the client this story forbids; its pure
`mapAuthError` keeps its own S2.1 tests. The `check` CI job runs `npm run test:coverage` and fails
below threshold; `npm run test` stays plain so it remains fast.
