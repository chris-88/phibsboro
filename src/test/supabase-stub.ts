/**
 * A `SupabaseClient`-shaped stub for the S7.1 state harness. It replaces `@/lib/supabase` so every
 * `src/api/` hook runs unchanged against it — the same client boundary `src/api/` already isolates,
 * so no screen or hook is modified for the test (open question 1: stub the client, do not add MSW).
 *
 * One scenario drives one source (a table for `.from(...)`, or `rpc:<fn>` for `.rpc(...)`): the
 * `driver`. The driver settles per the scenario; every other source always returns its populated
 * fixture, so a multi-query screen can reach its own empty or error state (for example the
 * empty-squad state on the manager event view) rather than the first query's.
 *
 *   'loading'   → the driver's terminal never settles
 *   'empty'     → { data: [], error: null }   (or { data: null } for .single()/.maybeSingle())
 *   'error'     → { data: null, error: { message: 'stub failure', code: 'PGRST000' } }
 *   'populated' → fixtures[source]
 */

export type Scenario = 'loading' | 'empty' | 'error' | 'populated'

/** Rows per source: a table name, or `rpc:<fn>`. Missing sources resolve to an empty array. */
export type Fixtures = Record<string, readonly unknown[]>

export interface StubOptions {
  scenario: Scenario
  fixtures: Fixtures
  /** The one source the non-populated scenario applies to. Undefined ⇒ every source is populated. */
  driver?: string
  /** Bumped every time the driver source issues a request, so a test can prove a Retry refetches. */
  onRequest?: (source: string) => void
}

const STUB_ERROR = { message: 'stub failure', code: 'PGRST000', details: '', hint: '' }
const NEVER = new Promise<never>(() => undefined)

interface Terminal {
  single: boolean
}

function resolveFor(source: string, opts: StubOptions, terminal: Terminal): Promise<unknown> {
  const active = opts.driver === source
  if (active) opts.onRequest?.(source)

  const scenario: Scenario = active ? opts.scenario : 'populated'
  if (scenario === 'loading') return NEVER
  if (scenario === 'error') return Promise.resolve({ data: null, error: STUB_ERROR })

  const rows = scenario === 'empty' ? [] : (opts.fixtures[source] ?? [])
  const data = terminal.single ? (rows[0] ?? null) : rows
  return Promise.resolve({ data, error: null })
}

/** A chainable, thenable query builder. Every filter/modifier returns itself; `.single()` and
 *  `.maybeSingle()` flip the terminal to object-shaped; `await`/`.then()` settles the result. */
function makeBuilder(source: string, opts: StubOptions): PromiseLike<unknown> {
  const terminal: Terminal = { single: false }
  const settle = (): Promise<unknown> => resolveFor(source, opts, terminal)

  const builder: Record<string, unknown> = {
    then: (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => settle().then(onF, onR),
    catch: (onR?: (e: unknown) => unknown) => settle().catch(onR),
    finally: (onFin?: () => void) => settle().finally(onFin),
    single: () => {
      terminal.single = true
      return proxy
    },
    maybeSingle: () => {
      terminal.single = true
      return proxy
    },
  }

  // Any other member (select, insert, update, delete, upsert, eq, in, gte, lt, order, limit,
  // range, match, filter, …) is a passthrough that returns the same builder.
  const proxy: PromiseLike<unknown> = new Proxy(builder, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) return target[prop]
      // Symbols (Symbol.toPrimitive, the thenable check's own probes) behave as on a plain object.
      if (typeof prop === 'symbol') return Reflect.get(target, prop) as unknown
      // Every other member — select, insert, update, delete, upsert, eq, in, gte, lt, order,
      // limit, range, match, filter, … — is a passthrough that returns the same builder.
      return () => proxy
    },
  }) as unknown as PromiseLike<unknown>

  return proxy
}

export interface SupabaseStub {
  from: (table: string) => PromiseLike<unknown>
  rpc: (fn: string, args?: unknown) => PromiseLike<unknown>
  auth: {
    getSession: () => Promise<{ data: { session: null }; error: null }>
    onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } }
    signOut: () => Promise<{ error: null }>
  }
}

export function stubSupabase(opts: StubOptions): SupabaseStub {
  return {
    from: (table) => makeBuilder(table, opts),
    rpc: (fn) => makeBuilder(`rpc:${fn}`, opts),
    // Sessions are supplied to the router through SessionContext directly, so the auth surface is
    // only here to keep any incidental call inert.
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
  }
}
