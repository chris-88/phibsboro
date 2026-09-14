import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AttendancePill } from '@/features/attendance/components/AttendancePill'

// AC3/AC4: one pill per row, each carrying its word so the states are separable without colour.
describe('AttendancePill (S3.5)', () => {
  it('reads "Attended" for an attended row', () => {
    render(<AttendancePill state="attended" cancelled={false} />)
    expect(screen.getByText('Attended')).toBeInTheDocument()
  })

  it('reads "Absent" for an absent row', () => {
    render(<AttendancePill state="absent" cancelled={false} />)
    expect(screen.getByText('Absent')).toBeInTheDocument()
  })

  it('reads "Not recorded" when no attendance row exists (D25)', () => {
    render(<AttendancePill state="not-recorded" cancelled={false} />)
    expect(screen.getByText('Not recorded')).toBeInTheDocument()
  })

  it('reads "Cancelled" and no attendance word for a cancelled event (AC4)', () => {
    render(<AttendancePill state="not-recorded" cancelled />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByText('Not recorded')).not.toBeInTheDocument()
  })
})
