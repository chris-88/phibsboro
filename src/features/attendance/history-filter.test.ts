import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { filterHistory } from '@/features/attendance/history-filter'
import { historyRowSchema, type HistoryRow } from '@/features/attendance/schema'
import type { TeamMembership } from '@/features/auth/use-current-user'

// TZ=UTC is pinned by vitest.config.ts (D53). All instants below are fixed UTC, so the epoch
// comparison in filterHistory is deterministic on any runner.

const TEAM_A = '00000000-0000-4000-8000-0000000000a0'
const TEAM_B = '00000000-0000-4000-8000-0000000000b0'
const EVENT = '00000000-0000-4000-8000-000000000101'

const row = (over: Partial<HistoryRow> = {}): HistoryRow => ({
  id: EVENT,
  team_id: TEAM_A,
  type: 'training',
  title: 'Training',
  starts_at: '2026-03-14T19:30:00.000Z',
  status: 'scheduled',
  attendance: 'not-recorded',
  ...over,
})

const member = (teamId: string, joinedAt: string): TeamMembership => ({
  teamId,
  teamName: 'Team',
  role: 'player',
  joinedAt,
})

describe('filterHistory (S3.5)', () => {
  it('keeps an attended row on a team the player has left, with no membership (AC7)', () => {
    const rows = [row({ attendance: 'attended' })]
    expect(filterHistory(rows, [])).toEqual(rows)
  })

  it('keeps an absent row from before the player joined (AC8)', () => {
    const rows = [row({ attendance: 'absent' })]
    // Joined a month after the event, yet the recorded result keeps it.
    expect(filterHistory(rows, [member(TEAM_A, '2026-04-14T00:00:00.000Z')])).toEqual(rows)
  })

  it('drops a not-recorded row on a team joined after the event (AC8)', () => {
    const rows = [row({ attendance: 'not-recorded' })]
    expect(filterHistory(rows, [member(TEAM_A, '2026-04-14T00:00:00.000Z')])).toEqual([])
  })

  it('keeps a not-recorded row when joinedAt equals starts_at exactly', () => {
    const rows = [row({ attendance: 'not-recorded', starts_at: '2026-03-14T19:30:00.000Z' })]
    expect(filterHistory(rows, [member(TEAM_A, '2026-03-14T19:30:00.000Z')])).toEqual(rows)
  })

  it('keeps a not-recorded row on a team joined before the event', () => {
    const rows = [row({ attendance: 'not-recorded' })]
    expect(filterHistory(rows, [member(TEAM_A, '2026-01-01T00:00:00.000Z')])).toEqual(rows)
  })

  it('an empty membership list keeps only rows with a recorded state', () => {
    const kept = row({ id: 'a', attendance: 'attended' })
    const dropped = row({ id: 'b', attendance: 'not-recorded' })
    expect(filterHistory([kept, dropped], [])).toEqual([kept])
  })

  it('judges a row against that row team membership only', () => {
    // A not-recorded row on team B, but the player is a pre-join member of team A only.
    const rows = [row({ team_id: TEAM_B, attendance: 'not-recorded' })]
    expect(filterHistory(rows, [member(TEAM_A, '2026-01-01T00:00:00.000Z')])).toEqual([])
    expect(filterHistory(rows, [member(TEAM_B, '2026-01-01T00:00:00.000Z')])).toEqual(rows)
  })
})

// The embed normaliser: the array of length 0 or 1 collapses to one of three words, and a
// two-element array (a widened policy) fails loudly at the boundary rather than three components
// deep. Parsed through the full row schema, since the transform lives there.
const parse = (attendance: { attended: boolean }[]) =>
  historyRowSchema.parse({
    id: EVENT,
    team_id: TEAM_A,
    type: 'training',
    title: 'Training',
    starts_at: '2026-03-14T19:30:00.000Z',
    status: 'scheduled',
    attendance,
  }).attendance

describe('historyRowSchema attendance normalisation (S3.5)', () => {
  it('maps [] to not-recorded (D25)', () => {
    expect(parse([])).toBe('not-recorded')
  })

  it('maps [{ attended: false }] to absent', () => {
    expect(parse([{ attended: false }])).toBe('absent')
  })

  it('maps [{ attended: true }] to attended', () => {
    expect(parse([{ attended: true }])).toBe('attended')
  })

  it('fails the .max(1) parse on a two-element array (a widened policy)', () => {
    expect(() =>
      z.array(historyRowSchema).parse([
        {
          id: EVENT,
          team_id: TEAM_A,
          type: 'training',
          title: 'Training',
          starts_at: '2026-03-14T19:30:00.000Z',
          status: 'scheduled',
          attendance: [{ attended: true }, { attended: false }],
        },
      ]),
    ).toThrow()
  })
})
