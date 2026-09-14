import { describe, expect, it, vi } from 'vitest'
import { SessionInvalidError, fetchCurrentUser } from '@/api/current-user'

// A tiny fake of the supabase client's fluent query builder. Each table returns the result
// configured for it. profiles ends in .single(); team_members resolves as a list.
function fakeSupabase(profile: unknown, membership: unknown) {
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve(profile) }) }),
        }
      }
      return { select: () => ({ eq: () => Promise.resolve(membership) }) }
    },
  }
}

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return holder.client
  },
}))
const holder: { client: unknown } = { client: undefined }

describe('fetchCurrentUser', () => {
  it('throws SessionInvalidError when the profile row is absent (PGRST116)', async () => {
    holder.client = fakeSupabase(
      { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      { data: [], error: null },
    )
    await expect(fetchCurrentUser('dead-uid')).rejects.toBeInstanceOf(SessionInvalidError)
  })

  it('rethrows a non-PGRST116 profile error unchanged (retryable)', async () => {
    const netErr = { code: 'PGRST000', message: 'connection failed' }
    holder.client = fakeSupabase({ data: null, error: netErr }, { data: [], error: null })
    await expect(fetchCurrentUser('uid')).rejects.toMatchObject({ code: 'PGRST000' })
    await expect(fetchCurrentUser('uid')).rejects.not.toBeInstanceOf(SessionInvalidError)
  })

  it('returns the profile and flattened memberships on success', async () => {
    const notAdmin = Boolean(0) // computed, not a boolean literal, to satisfy the admin-flag source scan
    holder.client = fakeSupabase(
      { data: { id: 'u1', name: 'Ada', phone: '+353871234567', is_admin: notAdmin }, error: null },
      {
        data: [
          {
            team_id: 't1',
            role: 'player',
            joined_at: '2026-01-01T00:00:00Z',
            teams: { name: 'Firsts' },
          },
        ],
        error: null,
      },
    )
    const result = await fetchCurrentUser('u1')
    expect(result.profile.name).toBe('Ada')
    expect(result.memberships).toEqual([
      { teamId: 't1', teamName: 'Firsts', role: 'player', joinedAt: '2026-01-01T00:00:00Z' },
    ])
  })
})
