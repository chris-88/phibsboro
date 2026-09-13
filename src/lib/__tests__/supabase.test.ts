import { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authOptions, supabase } from '@/lib/supabase'

describe('the one Supabase client (AC4, AC5)', () => {
  it('is a SupabaseClient built from the validated env', () => {
    expect(supabase).toBeInstanceOf(SupabaseClient)
  })

  it('carries the four session flags S2.6 depends on', () => {
    expect(authOptions).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'pfc.auth',
    })
  })
})
