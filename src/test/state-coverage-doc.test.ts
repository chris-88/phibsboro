import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/test/route-manifest'

/**
 * S7.1 AC1/AC2 honesty check. Parses the route column of `docs/state-coverage.md` and fails if it
 * drifts from the `ROUTES` manifest, so the audit document and the harness cannot fall out of step
 * without a red test. It also asserts no cell in the route rows is blank — every state is either a
 * named test or an explicit `n/a — <reason>`.
 */

// Vitest runs from the repo root, so the doc is resolved from the working directory rather than
// import.meta.url (which is not always a file: URL under the test runner).
const DOC = resolve(process.cwd(), 'docs/state-coverage.md')

function tableRows(md: string): string[][] {
  return md
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
}

/** A first cell that is a route: a backticked path, or the literal 404. Header, separator and the
 *  conditional-surface rows fail this and are skipped. */
function routeCode(firstCell: string): string | null {
  const bare = firstCell.replace(/`/g, '').trim()
  if (bare === '404') return '404'
  if (bare.startsWith('/')) return bare
  return null
}

describe('docs/state-coverage.md stays in step with the route manifest (AC1)', () => {
  const md = readFileSync(DOC, 'utf8')
  const rows = tableRows(md)
  const routeRows = rows.filter((cells) => routeCode(cells[0] ?? '') !== null)

  it('lists exactly the manifest routes, in order', () => {
    const codes = routeRows.map((cells) => routeCode(cells[0] ?? ''))
    expect(codes).toEqual(ROUTES.map((r) => r.code))
  })

  it('leaves no state cell blank on any route row', () => {
    for (const cells of routeRows) {
      // Route + four state columns.
      expect(cells.length).toBeGreaterThanOrEqual(5)
      for (const cell of cells.slice(1, 5)) {
        expect(cell).not.toBe('')
      }
    }
  })
})
