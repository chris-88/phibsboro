#!/usr/bin/env node
// Grep-level conventions ESLint cannot see. Later stories append checks here.
//
// | Check                                                    | Owner | Rule                                      |
// |----------------------------------------------------------|-------|-------------------------------------------|
// | SERVICE_ROLE outside .env.example, supabase/, tests/helpers/admin.ts | S0.1, S1.1 | belt and braces alongside the lint rule (D38, D15) |
// | A hex colour literal under src/ outside the token sheet   | S0.2  | no hardcoded hex in components, AC3; S10.1 allows teams/palette.ts |
// | The literal '/#/' outside src/lib/paths.ts                | S0.3  | one URL builder, AC8, D13                 |
// | useParams() outside src/lib/use-route-param.ts            | S0.3  | typed params, no `!` on a segment, AC10   |
// | display-mode: standalone / navigator.standalone elsewhere | S0.4  | one isStandalone() helper, AC9, D44       |
// | The pfc-release meta read outside src/lib/version.ts      | S0.4  | one reader of the release tag, AC14       |
// | setUser( outside src/lib/sentry.ts                        | S0.6  | Sentry user is the auth uuid only, AC10   |

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
/** Spawns this script against throwaway trees, so it carries the strings it tests for. */
const FIXTURE_TEST = join('src', '__tests__', 'check-conventions.test.ts')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'spec', 'test-results'])

/** @type {{name: string, roots: string[], exts: string[], pattern: RegExp, allow: (p: string) => boolean, message: string}[]} */
const CHECKS = [
  {
    name: 'service-role-key',
    roots: ['src', 'scripts', 'tests'],
    exts: ['.ts', '.tsx', '.js', '.mjs', '.json', '.html'],
    pattern: /SERVICE_ROLE/,
    // This file names the pattern it searches for, so it has to exempt itself.
    // tests/helpers/admin.ts is the one place tests hold the key, for setup only (D15).
    allow: (p) =>
      p === '.env.example' ||
      p === join('scripts', 'check-conventions.mjs') ||
      p === join('tests', 'helpers', 'admin.ts') ||
      // S1.2's AC27 scan searches for the string, so it has to hold it.
      p === join('tests', 'guards', 'source-scan.test.ts') ||
      p.startsWith(`supabase${sep}`),
    message:
      'The service-role key never appears in the browser bundle or the client tree. Decision D38.',
  },
  {
    name: 'hardcoded-hex',
    roots: ['src'],
    exts: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    // 3, 4, 6 or 8 hex digits, not part of a longer word.
    pattern: /(?<![\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F\w])/,
    // The whole allowlist. src/index.css is where every colour in the app is written, and
    // src/pwa/manifest.ts (S0.4) must repeat the two --pwa-* values because a manifest
    // cannot read CSS.
    // src/features/teams/palette.ts (S10.1) holds the team-colour palette: hexes stored per-row
    // in the database, which cannot live in index.css.
    allow: (p) =>
      p === join('src', 'index.css') ||
      p === join('src', 'pwa', 'manifest.ts') ||
      p === join('src', 'features', 'teams', 'palette.ts'),
    message:
      'Colours are semantic tokens from src/index.css, never hex literals. CLAUDE.md section 3, S0.2 AC3.',
  },
  {
    name: 'hash-literal',
    roots: ['src'],
    exts: ['.ts', '.tsx', '.js', '.jsx'],
    pattern: /\/#\//,
    // The builder, the test that pins its output byte for byte, and the scrubber fixtures.
    allow: (p) =>
      p === join('src', 'lib', 'paths.ts') ||
      p === join('src', 'lib', '__tests__', 'paths.test.ts') ||
      // S0.6: the token fixtures the scrubber must truncate are literal hash URLs.
      p === join('src', 'lib', '__tests__', 'sentry-scrub.test.ts'),
    message:
      'Only src/lib/paths.ts builds a URL containing the hash. Import absoluteUrl/eventUrl from @/lib/paths. S0.3 AC8, D13.',
  },
  {
    name: 'use-params',
    roots: ['src'],
    exts: ['.ts', '.tsx'],
    pattern: /\buseParams\s*\(/,
    allow: (p) => p === join('src', 'lib', 'use-route-param.ts'),
    message:
      'Read route segments with useRouteParam() from @/lib/use-route-param, which returns a string or throws. S0.3 AC10.',
  },
  {
    name: 'standalone-check',
    roots: ['src'],
    exts: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    pattern: /display-mode:\s*standalone|navigator\s*\.\s*standalone/,
    // The helper, the test that exercises both halves of it, and the fixture test that
    // holds the forbidden strings as data to prove this rule fires. Nothing else.
    allow: (p) =>
      p === join('src', 'lib', 'standalone.ts') ||
      p === join('src', 'lib', '__tests__', 'standalone.test.ts') ||
      p === FIXTURE_TEST,
    message:
      'The media query is wrong on iOS. Call isStandalone() from @/lib/standalone, the one helper. S0.4 AC9, D44.',
  },
  {
    name: 'release-tag-reader',
    roots: ['src'],
    exts: ['.ts', '.tsx', '.js', '.jsx'],
    pattern: /pfc-release/,
    // The reader, the tests that plant the tag to exercise it, and the fixture test.
    allow: (p) =>
      p === join('src', 'lib', 'version.ts') ||
      p === join('src', 'lib', '__tests__', 'version.test.ts') ||
      p === join('src', 'components', '__tests__', 'version-tag.test.tsx') ||
      p === FIXTURE_TEST,
    message:
      'Read the running build with getAppVersion() from @/lib/version, the only reader of the pfc-release tag. S0.4 AC14.',
  },
  {
    name: 'sentry-set-user',
    roots: ['src'],
    exts: ['.ts', '.tsx', '.js', '.jsx'],
    pattern: /\bsetUser\s*\(/,
    // The wrapper, its test (which asserts the call it makes), and the fixture test.
    allow: (p) =>
      p === join('src', 'lib', 'sentry.ts') ||
      p === join('src', 'lib', '__tests__', 'sentry.test.ts') ||
      p === FIXTURE_TEST,
    message:
      'Identify the user to Sentry with setSentryUser(id) from @/lib/sentry: the auth uuid and nothing else, never phone or name. S0.6 AC10, D16.',
  },
]

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

let failures = 0
for (const check of CHECKS) {
  for (const root of check.roots) {
    for (const file of walk(join(ROOT, root))) {
      const rel = relative(ROOT, file)
      if (!check.exts.some((e) => file.endsWith(e))) continue
      if (check.allow(rel)) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (check.pattern.test(line)) {
          console.error(`${rel}:${i + 1}  [${check.name}] ${check.message}`)
          console.error(`  ${line.trim()}`)
          failures++
        }
      })
    }
  }
}

if (failures > 0) {
  console.error(`\ncheck-conventions: ${failures} violation${failures === 1 ? '' : 's'}.`)
  process.exit(1)
}
console.log('check-conventions: clean')
