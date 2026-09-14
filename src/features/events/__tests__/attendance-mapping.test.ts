import { describe, expect, it } from 'vitest'
import { toAttended } from '@/features/events/components/attendance-value'

describe('toAttended (S4.5)', () => {
  it('maps the three ToggleGroup values and the Radix deselect to the stored column', () => {
    expect(toAttended('yes')).toBe(true)
    expect(toAttended('no')).toBe(false)
    expect(toAttended('none')).toBeNull()
    // Radix emits '' when the active item is tapped again — clear the row (AC3).
    expect(toAttended('')).toBeNull()
  })
})
