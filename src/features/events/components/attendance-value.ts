/**
 * The one place the attendance ToggleGroup value maps to and from the stored `attended` column, so
 * it is unit-testable and never repeated (S4.5). It lives beside `PlayerResponseCard` in its own
 * module because that file may only export components (react-refresh).
 */

/** The ToggleGroup item value for a stored attendance state. */
export function attendanceValue(attended: boolean | null): 'none' | 'yes' | 'no' {
  if (attended === null) return 'none'
  return attended ? 'yes' : 'no'
}

/**
 * `'yes'` → attended, `'no'` → absent, `'none'` → not recorded; and `''`, which Radix emits when the
 * active item is tapped again, is also "not recorded" — that gesture is exactly AC3.
 */
export function toAttended(value: string): boolean | null {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}
