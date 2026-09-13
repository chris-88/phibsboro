/// <reference types="node" />
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

// The S1.5 conventions are lint rules, so this proves each rule fires and each exemption holds
// by linting snippets through the real eslint.config.js. Type-aware rules are switched off for
// speed: none of the rules under test need a program, and every path here is hypothetical.
const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfig: [{ files: ['**/*.{ts,tsx}'], ...tseslint.configs.disableTypeChecked }],
})

async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'fatal'}: ${m.message}`)
}

const ANY = 'src/features/events/probe.ts'

describe('AC13 — one date formatter', () => {
  const locale = "export const s = new Date().toLocaleString('en-IE')\n"
  const intl = "export const f = new Intl.DateTimeFormat('en-IE')\n"

  it('fails toLocaleString and new Intl.DateTimeFormat anywhere under src/', async () => {
    expect(await lint(ANY, locale)).toContainEqual(expect.stringContaining('formatEventTime()'))
    expect(await lint(ANY, intl)).toContainEqual(expect.stringContaining('formatEventTime()'))
  })

  it('allows both in src/lib/time.ts and nowhere else', async () => {
    expect(await lint('src/lib/time.ts', locale + intl)).toEqual([])
    expect(await lint('src/lib/env.ts', intl)).not.toEqual([])
  })

  it('does not ban Intl.Collator (A13)', async () => {
    expect(await lint(ANY, "export const c = new Intl.Collator('en')\n")).toEqual([])
  })
})

describe('AC4 — one Supabase client', () => {
  const code =
    "import { createClient } from '@supabase/supabase-js'\nexport const c = createClient\n"

  it('fails a createClient import outside src/lib/supabase.ts', async () => {
    expect(await lint(ANY, code)).toContainEqual(expect.stringContaining('@/lib/supabase'))
    expect(await lint('src/api/events.ts', code)).toContainEqual(
      expect.stringContaining('@/lib/supabase'),
    )
  })

  it('allows it in src/lib/supabase.ts', async () => {
    expect(await lint('src/lib/supabase.ts', code)).toEqual([])
  })

  it('other named imports from supabase-js are fine', async () => {
    expect(
      await lint(
        ANY,
        "import type { PostgrestError } from '@supabase/supabase-js'\nexport type E = PostgrestError\n",
      ),
    ).toEqual([])
  })
})

describe('AC1 — generated types reached through src/lib/db.ts', () => {
  const alias = "import type { Database } from '@/lib/database.types'\nexport type D = Database\n"
  const relative = "import type { Database } from './database.types'\nexport type D = Database\n"

  it('fails a direct import of the generated file, aliased or relative', async () => {
    expect(await lint(ANY, alias)).toContainEqual(expect.stringContaining('@/lib/db'))
    expect(await lint('src/lib/supabase.ts', relative)).toContainEqual(
      expect.stringContaining('@/lib/db'),
    )
  })

  it('allows it in src/lib/db.ts only', async () => {
    expect(await lint('src/lib/db.ts', alias)).toEqual([])
  })
})

describe('AC6 — two readers of import.meta.env', () => {
  const code = 'export const u = import.meta.env.VITE_SUPABASE_URL\n'

  it('fails everywhere else under src/', async () => {
    expect(await lint(ANY, code)).toContainEqual(expect.stringContaining('@/lib/env'))
    expect(await lint('src/lib/paths.ts', code)).toContainEqual(
      expect.stringContaining('@/lib/env'),
    )
    expect(await lint('src/lib/time.ts', code)).toContainEqual(expect.stringContaining('@/lib/env'))
  })

  it('allows src/lib/env.ts, src/lib/sentry.ts and tests', async () => {
    expect(await lint('src/lib/env.ts', code)).toEqual([])
    expect(await lint('src/lib/sentry.ts', code)).toEqual([])
    expect(await lint('src/lib/__tests__/probe.test.ts', code)).toEqual([])
    expect(await lint('src/pwa/probe.test.ts', code)).toEqual([])
  })
})

describe('AC7 — the service-role key never appears under src/', () => {
  // Assembled at runtime: the literal would itself fail check-conventions and the S1.2 source scan.
  const WORD = ['SERVICE', 'ROLE'].join('_')

  it('fails any identifier containing the word, including inside the exempt files', async () => {
    const code = `export const SUPABASE_${WORD}_KEY = 'x'\n`
    expect(await lint(ANY, code)).toContainEqual(expect.stringContaining('D38'))
    expect(await lint('src/lib/time.ts', code)).toContainEqual(expect.stringContaining('D38'))
    expect(await lint('src/lib/env.ts', code)).toContainEqual(expect.stringContaining('D38'))
    expect(await lint('src/api/queryKeys.ts', code)).toContainEqual(expect.stringContaining('D38'))
  })

  it('fails a VITE_-prefixed reference to a service key', async () => {
    const code = `export const k = import.meta.env.VITE_${WORD}_KEY\n`
    expect(await lint('src/lib/env.ts', code)).toContainEqual(expect.stringContaining('D38'))
  })
})

describe('AC15 — three key factories, no literal keys', () => {
  it('fails a string-literal queryKey, plain or as const', async () => {
    const plain = "export const o = { queryKey: ['events', 'x'] }\n"
    const asConst = "export const o = { queryKey: ['events', 'x'] as const }\n"
    expect(await lint(ANY, plain)).toContainEqual(expect.stringContaining('@/api/queryKeys'))
    expect(await lint(ANY, asConst)).toContainEqual(expect.stringContaining('@/api/queryKeys'))
  })

  it('fails a fourth exported factory', async () => {
    const code = "export const joinKeys = { all: ['join'] as const }\n"
    expect(await lint(ANY, code)).toContainEqual(expect.stringContaining('No fourth key factory'))
  })

  it('allows a key built from a factory, and allows the factories in src/api/queryKeys.ts', async () => {
    const usage =
      "import { eventKeys } from '@/api/queryKeys'\nexport const o = { queryKey: eventKeys.preview('x') }\n"
    expect(await lint(ANY, usage)).toEqual([])
    const factory = "export const eventKeys = { all: ['events'] as const } as const\n"
    expect(await lint('src/api/queryKeys.ts', factory)).toEqual([])
  })
})

describe('S2.1 DoD — the auth seam is the only caller of signUp / signInWithPassword', () => {
  const signUp = 'export const go = () => supabase.auth.signUp({ phone, password })\n'
  const signIn = 'export const go = () => supabase.auth.signInWithPassword({ phone, password })\n'

  it('fails a signUp or signInWithPassword call anywhere else under src/', async () => {
    expect(await lint(ANY, signUp)).toContainEqual(expect.stringContaining('@/lib/auth'))
    expect(await lint('src/api/auth.ts', signIn)).toContainEqual(
      expect.stringContaining('@/lib/auth'),
    )
  })

  it('allows both in src/lib/auth.ts only', async () => {
    expect(await lint('src/lib/auth.ts', signUp + signIn)).toEqual([])
  })
})

describe('AC17 — no any', () => {
  it('no-explicit-any is an error', async () => {
    expect(await lint(ANY, 'export const a: any = 1\n')).toContainEqual(
      expect.stringMatching(/^@typescript-eslint\/no-explicit-any/),
    )
  })
})
