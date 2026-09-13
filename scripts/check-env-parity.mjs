#!/usr/bin/env node
// AC14 — .env.example and the deploy workflow's build job must declare the same VITE_ keys.
// Adding a variable to one without the other is the failure this catches: a build that reads a
// variable nobody documented, or a documented variable the deploy never sets.

import { readFileSync } from 'node:fs'

const ENV_EXAMPLE = '.env.example'
const WORKFLOW = '.github/workflows/deploy.yml'
const VITEST = 'vitest.config.ts'

// VITE_SENTRY_RELEASE is set by the workflow to ${{ github.sha }}, deliberately outside the marked
// block because it comes from the commit rather than from a repository variable. .env.example still
// documents it for local use, so it is exempt from the "missing from the workflow" direction.
const SET_BY_WORKFLOW = new Set(['VITE_SENTRY_RELEASE'])

const fromEnvExample = new Set(
  readFileSync(ENV_EXAMPLE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0])
    .filter((k) => k?.startsWith('VITE_')),
)

// The build job's env: block, delimited by the markers below so this parser stays dumb and honest
// rather than pretending to understand YAML.
const workflow = readFileSync(WORKFLOW, 'utf8')
const START = '# env-parity:start'
const END = '# env-parity:end'
const from = workflow.indexOf(START)
const to = workflow.indexOf(END)
if (from === -1 || to === -1) {
  console.error(`check-env-parity: ${WORKFLOW} is missing the ${START} / ${END} markers.`)
  process.exit(1)
}
const fromWorkflow = new Set(
  workflow
    .slice(from, to)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('VITE_'))
    .map((l) => l.split(':')[0]),
)

// The unit suite must be hermetic: every documented key gets a value in vitest.config.ts's
// test.env, or a test that reads it passes locally off .env.local and fails on a clean runner.
const vitestSrc = readFileSync(VITEST, 'utf8')
const envBlock = vitestSrc.match(/env:\s*\{([\s\S]*?)\n\s*\}/)
const fromVitest = new Set(
  (envBlock?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('VITE_'))
    .map((l) => l.split(':')[0]),
)
const missingFromVitest = [...fromEnvExample].filter((k) => !fromVitest.has(k))

const missingFromWorkflow = [...fromEnvExample].filter(
  (k) => !fromWorkflow.has(k) && !SET_BY_WORKFLOW.has(k),
)
const missingFromExample = [...fromWorkflow].filter((k) => !fromEnvExample.has(k))

let failed = false
for (const k of missingFromWorkflow) {
  console.error(`${k} is in ${ENV_EXAMPLE} but not in the build job's env block.`)
  failed = true
}
for (const k of missingFromExample) {
  console.error(`${k} is in the build job's env block but not in ${ENV_EXAMPLE}.`)
  failed = true
}
for (const k of missingFromVitest) {
  console.error(
    `${k} is in ${ENV_EXAMPLE} but not in ${VITEST}'s test.env — the unit suite is not hermetic.`,
  )
  failed = true
}

if (failed) {
  console.error('\ncheck-env-parity: the two must declare the same VITE_ keys (S0.5 AC14).')
  process.exit(1)
}
console.log(
  `check-env-parity: clean (${fromEnvExample.size} VITE_ keys in .env.example, deploy.yml and vitest.config.ts)`,
)
