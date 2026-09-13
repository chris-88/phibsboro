/// <reference lib="dom" />
import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Database } from '../../src/lib/database.types.ts'
import { MANAGERS, PLAYERS, SEED_PASSWORD } from '../../supabase/seed/fixtures.ts'
import { PREVIEW_URL } from './pwa-helpers.ts'

// S2.9's guard journeys need a real session, but there is no sign-in screen at build order 15,
// so the session is minted programmatically with a seeded account and written into the
// `pfc.auth` storage key the client pins (S1.5). Playwright then loads the preview with that
// storage state and the app restores the session on boot — exactly the S2.6 path, proved here.
//
// Runs against whatever Supabase the preview build points at. In CI that is the seeded project;
// locally it is the value in .env.local. No Docker required beyond a seeded database.

export const PLAYER_STATE = 'tests/e2e/.auth/player.json'
export const MANAGER_STATE = 'tests/e2e/.auth/manager.json'

const PLAYER = PLAYERS[0]
const MANAGER = MANAGERS[0] // manages Firsts

/** Env, process first then .env.local, so the setup runs the same in CI and on a laptop. */
function env(key: string): string {
  const fromProcess = process.env[key]
  if (fromProcess) return fromProcess
  let text = ''
  try {
    text = readFileSync('.env.local', 'utf8')
  } catch {
    // No file: the environment must carry it.
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq !== -1 && trimmed.slice(0, eq) === key) return trimmed.slice(eq + 1)
  }
  throw new Error(`auth.setup needs ${key} in the environment or .env.local`)
}

/** Signs in as `phone` and captures the JSON the client would persist under `pfc.auth`. */
async function sessionJson(phone: string): Promise<string> {
  let stored = ''
  const client = createClient<Database>(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
    auth: {
      storageKey: 'pfc.auth',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => (key === 'pfc.auth' ? stored : null),
        setItem: (key, value) => {
          if (key === 'pfc.auth') stored = value
        },
        removeItem: (key) => {
          if (key === 'pfc.auth') stored = ''
        },
      },
    },
  })
  const { error } = await client.auth.signInWithPassword({ phone, password: SEED_PASSWORD })
  if (error) throw new Error(`sign-in as ${phone} failed: ${error.message}`)
  if (!stored) throw new Error(`no session persisted for ${phone}`)
  return stored
}

/** A Playwright storage state seeding one localStorage entry on the preview origin. */
function writeState(path: string, value: string): void {
  const state = {
    cookies: [],
    origins: [{ origin: PREVIEW_URL, localStorage: [{ name: 'pfc.auth', value }] }],
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state))
}

setup('sign in the seeded player', async () => {
  writeState(PLAYER_STATE, await sessionJson(PLAYER.phone))
})

setup('sign in the seeded manager', async () => {
  writeState(MANAGER_STATE, await sessionJson(MANAGER.phone))
})
