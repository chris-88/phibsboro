// S3.3 AC15 — the manager embed regression guard, beyond what S1.4 already asserts on
// event_responses. A manager's select policy on event_responses returns every row for events on
// their teams (D32/D33), and managers play (D22), so the app's member read embeds the responses
// filtered to `auth.uid()`. This proves the filter is load-bearing: without it the same read
// hands back the whole squad, and `data.event_responses[0]` would be an arbitrary teammate's
// answer. Declan (managerFirsts) manages Firsts and holds his own 'available' row on the imminent
// event, which carries ten responses in the seed.
import { describe, expect, it } from 'vitest'

import { EVENT_SELECT } from '../../src/api/events.ts'
import { idOf, signInAs } from './helpers/clients.ts'
import { EVENT } from './helpers/fixtures.ts'

interface EmbedRow {
  event_responses: { response: string; user_id: string }[]
}

describe('S3.3 AC15 — the member read embeds only the caller’s own response', () => {
  it('a manager reading a multi-response event they manage gets exactly their own row', async () => {
    const declan = await signInAs('managerFirsts')
    const { data, error } = await declan
      .from('events')
      .select(EVENT_SELECT)
      .eq('id', EVENT.firsts.imminent.id)
      .eq('event_responses.user_id', idOf('managerFirsts'))
      .maybeSingle<EmbedRow>()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.event_responses).toHaveLength(1)
    expect(data?.event_responses[0]?.user_id).toBe(idOf('managerFirsts'))
    expect(data?.event_responses[0]?.response).toBe('available')
  })

  it('without the user_id filter the same manager read returns the whole squad — the bug guarded', async () => {
    const declan = await signInAs('managerFirsts')
    const { data, error } = await declan
      .from('events')
      .select(EVENT_SELECT)
      .eq('id', EVENT.firsts.imminent.id)
      .maybeSingle<EmbedRow>()
    expect(error).toBeNull()
    // The seed puts ten responses on this event; the point is only that it is more than one.
    expect(data?.event_responses.length ?? 0).toBeGreaterThan(1)
  })
})
