import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { squadRowSchema } from '@/features/events/schema'
import { mapRpcError, toAppError } from '@/lib/errors'

const validRow = {
  event_id: '00000000-0000-4000-8000-000000000104',
  user_id: '00000000-0000-4000-8000-0000000000aa',
  shirt_number: 7,
  is_captain: true,
  recorded_by: '00000000-0000-4000-8000-0000000000bb',
  updated_at: '2026-09-14T18:00:00+00:00',
}

describe('squadRowSchema (S9.1)', () => {
  it('parses a well-formed squad row', () => {
    expect(squadRowSchema.parse(validRow)).toEqual(validRow)
  })

  it('rejects a shirt number outside 1–20 and a non-integer', () => {
    expect(squadRowSchema.safeParse({ ...validRow, shirt_number: 0 }).success).toBe(false)
    expect(squadRowSchema.safeParse({ ...validRow, shirt_number: 21 }).success).toBe(false)
    expect(squadRowSchema.safeParse({ ...validRow, shirt_number: 7.5 }).success).toBe(false)
  })

  it('rejects a malformed uuid', () => {
    expect(squadRowSchema.safeParse({ ...validRow, user_id: 'not-a-uuid' }).success).toBe(false)
  })
})

const pg = (message: string): PostgrestError =>
  ({ message, code: 'P0001', details: '', hint: '', name: 'PostgrestError' }) as PostgrestError

describe('the squad RPC error words map cleanly (S9.1, V7)', () => {
  it.each(['not_available', 'number_taken', 'captain_taken'] as const)(
    'maps %s to its own code and a non-empty line naming no column',
    (word) => {
      expect(toAppError(pg(word)).code).toBe(word)
      const copy = mapRpcError(word)
      expect(copy.length).toBeGreaterThan(0)
      expect(copy).not.toContain('event_squad')
      expect(copy).not.toContain('_')
    },
  )

  it('gives each word its own distinct line', () => {
    const lines = new Set([
      mapRpcError('not_available'),
      mapRpcError('number_taken'),
      mapRpcError('captain_taken'),
    ])
    expect(lines.size).toBe(3)
  })
})
