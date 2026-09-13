// S1.5 AC16 — the worked hook, end to end through the app's own client against the hosted
// project: the single `supabase` instance with its session options, `callRpc`, the error
// mapper and the Zod parse. Signed out throughout, which is the cold WhatsApp arrival (D7).
// No React here: `eventPreviewOptions` is the same queryFn `useEventPreview` mounts, so the
// row this returns is the row the hook renders, and the render half is unit tested in
// src/api/__tests__/events.test.tsx.
import { QueryClient } from '@tanstack/react-query'
import { beforeAll, describe, expect, it } from 'vitest'

import { eventPreviewOptions } from '../../src/api/events.ts'
import { callRpc } from '../../src/api/rpc.ts'
import { env } from '../../src/lib/env.ts'
import { AppError } from '../../src/lib/errors.ts'
import { supabase } from '../../src/lib/supabase.ts'
import { TARGET } from '../helpers/target.ts'
import { EVENT, FIRSTS, UNKNOWN_UUID } from './helpers/fixtures.ts'

describe('useEventPreview through the real client, signed out', () => {
  beforeAll(async () => {
    // The app client must be pointed at the same project the suite just reseeded, or the
    // rows below prove nothing.
    expect(env.VITE_SUPABASE_URL).toBe(TARGET.url)
    const { data } = await supabase.auth.getSession()
    expect(data.session).toBeNull()
  })

  it('returns the seeded event to an anonymous caller, parsed, without notes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const preview = await client.query(eventPreviewOptions(EVENT.firsts.imminent.id))
    expect(preview).not.toBeNull()
    expect(preview).toMatchObject({
      team_id: FIRSTS,
      team_name: 'Firsts',
      type: 'training',
      title: EVENT.firsts.imminent.title,
      location: EVENT.firsts.imminent.location,
      status: 'scheduled',
    })
    expect(Object.keys(preview ?? {}).sort()).toEqual([
      'location',
      'starts_at',
      'status',
      'team_id',
      'team_name',
      'title',
      'type',
    ])
    expect(preview).not.toHaveProperty('notes')
    // A timestamptz as PostgREST serialises it: what formatEventTime() will be handed.
    expect(preview?.starts_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('an unknown uuid resolves to null — not found is a state, not a throw', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await expect(client.query(eventPreviewOptions(UNKNOWN_UUID))).resolves.toBeNull()
  })

  it('a cancelled event previews as cancelled', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const preview = await client.query(eventPreviewOptions(EVENT.firsts.cancelled.id))
    expect(preview?.status).toBe('cancelled')
  })

  it('an RPC anon may not execute surfaces as AppError unknown, with the detail on cause', async () => {
    const attempt = callRpc('team_member_directory', { p_team_id: FIRSTS })
    await expect(attempt).rejects.toBeInstanceOf(AppError)
    await expect(attempt).rejects.toMatchObject({ code: 'unknown', message: 'unknown' })
    const error = await attempt.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    if (error instanceof AppError) {
      expect(error.cause).toMatchObject({ code: '42501' })
    }
  })

  it('a raised word arrives as its code: joining by event while signed out', async () => {
    // anon holds no execute on join_team_by_event, so this is a permission error, not the word;
    // the word path is proved with a signed-in caller in rpc-join.test.ts. Both map cleanly.
    const error = await callRpc('join_team_by_event', { p_event_id: UNKNOWN_UUID }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(AppError)
  })
})
