// S1.4 AC8 — the service-role client is for setup and arrange only. Grep rules over the tree, run
// in the unit suite so they need no database: nothing under src/ imports it, no RLS test file
// imports it, and the three helper files that do (arrange.ts, expect.ts, globalSetup.ts) never
// hand a test a way to read through it. The rules match identifiers, not lines, so a call that
// Prettier has wrapped across lines is caught the same as a one-liner.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(full)) yield full
  }
}

const lines = (file: string) => readFileSync(file, 'utf8').split('\n')

describe('the service-role client stays out of assertions (S1.4 AC8)', () => {
  it('nothing under src/ imports tests/helpers/admin.ts or anything under tests/', () => {
    const hits: string[] = []
    for (const file of walk('src')) {
      lines(file).forEach((line, i) => {
        if (/from\s+['"][^'"]*(helpers\/admin|\/tests\/)/.test(line))
          hits.push(`${relative('.', file)}:${String(i + 1)}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('no tests/rls/*.test.ts imports tests/helpers/admin.ts', () => {
    const hits: string[] = []
    for (const file of walk('tests/rls')) {
      if (!file.endsWith('.test.ts')) continue
      lines(file).forEach((line, i) => {
        if (/helpers\/admin(\.ts)?['"]/.test(line))
          hits.push(`${relative('.', file)}:${String(i + 1)}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('the service-role client reaches tests/rls only through arrange.ts, expect.ts and globalSetup.ts', () => {
    const importers = [...walk('tests/rls')]
      .filter((file) => /helpers\/admin(\.ts)?['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative('.', file))
      .sort()
    expect(importers).toEqual([
      'tests/rls/globalSetup.ts',
      'tests/rls/helpers/arrange.ts',
      'tests/rls/helpers/expect.ts',
    ])
  })

  it('no test file names the service-role client or the re-read primitive', () => {
    // A test cannot put either inside an expect(), on one line or many, without spelling it.
    const hits: string[] = []
    for (const file of walk('tests/rls')) {
      if (!file.endsWith('.test.ts')) continue
      lines(file).forEach((line, i) => {
        if (/\b(adminClient|readRows|createClient)\b/.test(line))
          hits.push(`${relative('.', file)}:${String(i + 1)}  ${line.trim()}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('arrange.ts is write-only and exports no client; expect.ts keeps its re-reads private', () => {
    const arrange = readFileSync('tests/rls/helpers/arrange.ts', 'utf8')
    expect(arrange).not.toMatch(/\.select\(|\.rpc\(|from ['"]vitest['"]/)
    expect(arrange).not.toMatch(/export\s+(const|let|var|function|async function)\s+admin\b/)
    expect(arrange).not.toMatch(/export\s*\{[^}]*\badmin(Client)?\b|export\s+\*/)
    const expectFile = readFileSync('tests/rls/helpers/expect.ts', 'utf8')
    expect(expectFile).not.toMatch(
      /export\s+(const|let|var|function|async function)\s+(readRows|adminClient)\b/,
    )
    expect(expectFile).not.toMatch(/export\s*\{[^}]*\b(readRows|adminClient)\b|export\s+\*/)
  })

  it('the suite has a file per table and per RPC group', () => {
    const files = readdirSync('tests/rls')
      .filter((f) => f.endsWith('.test.ts'))
      .sort()
    expect(files).toEqual([
      'api-event-preview.test.ts', // S1.5 AC16 — the worked hook through the app client
      'attendance.test.ts',
      'event-detail-embed.test.ts', // S3.3 AC15 — the member-read embed filter regression guard
      'event-responses.test.ts',
      'events.test.ts',
      'feedback.test.ts', // S12.1 — feedback table, RLS and resolve_feedback
      'match-stats.test.ts', // S17.3 - match_stats table RLS
      'profiles.test.ts',
      'reset-tokens.test.ts',
      'rpc-invites.test.ts',
      'rpc-join.test.ts',
      'rpc-members.test.ts',
      'rpc-preview.test.ts',
      'rpc-reset.test.ts',
      'rpc-series.test.ts',
      'squad.test.ts', // S9.1 — event_squad table, policies and RPCs
      'stranger.test.ts',
      'structural.test.ts',
      'team-invites.test.ts',
      'team-members.test.ts',
      'teams.test.ts',
    ])
  })
})
