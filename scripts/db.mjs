#!/usr/bin/env node
// Run SQL against the linked Supabase project through the Management API.
//
//   node scripts/db.mjs "select count(*) from profiles"
//   node scripts/db.mjs --file supabase/migrations/0001_schema.sql
//   echo "select now()" | node scripts/db.mjs
//   node scripts/db.mjs --file x.sql --json      # raw JSON instead of a table
//
// Runs as the `postgres` superuser, so it can do DDL: create tables, policies,
// functions, triggers. No database password is needed — the personal access token
// carries the authority. See docs/database.md.
//
// Credentials come from the environment, falling back to .env.local. Nothing is
// ever printed that could leak one.

import { readFileSync } from 'node:fs'

const API = 'https://api.supabase.com/v1'

function loadEnvLocal() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      process.env[key] ??= trimmed.slice(eq + 1)
    }
  } catch {
    // No .env.local is fine when the values are already in the environment, as in CI.
  }
}

loadEnvLocal()

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF

if (!TOKEN || !REF) {
  console.error('db: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set.')
  console.error('    Put them in .env.local (see scripts/setup-credentials.sh) or the environment.')
  process.exit(1)
}

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const fileFlag = argv.indexOf('--file')

let sql
if (fileFlag !== -1) {
  const path = argv[fileFlag + 1]
  if (!path) {
    console.error('db: --file needs a path')
    process.exit(1)
  }
  sql = readFileSync(path, 'utf8')
} else {
  const positional = argv.filter((a) => !a.startsWith('--'))
  sql = positional.join(' ').trim() || readFileSync(0, 'utf8')
}

if (!sql.trim()) {
  console.error('db: no SQL given')
  process.exit(1)
}

const response = await fetch(`${API}/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const text = await response.text()

if (!response.ok) {
  console.error(`db: HTTP ${String(response.status)}`)
  console.error(text)
  process.exit(1)
}

let rows
try {
  rows = JSON.parse(text)
} catch {
  console.log(text)
  process.exit(0)
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

if (!Array.isArray(rows) || rows.length === 0) {
  console.log('(no rows)')
  process.exit(0)
}

// Plain aligned table. Keeps output readable in a terminal without a dependency.
const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
const cell = (r, c) => {
  const v = r[c]
  return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
}
const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => cell(r, c).length)))
const line = (cells) => cells.map((v, i) => v.padEnd(widths[i] ?? 0)).join('  ')

console.log(line(columns))
console.log(widths.map((w) => '-'.repeat(w)).join('  '))
for (const r of rows) console.log(line(columns.map((c) => cell(r, c))))
console.log(`\n(${String(rows.length)} row${rows.length === 1 ? '' : 's'})`)
