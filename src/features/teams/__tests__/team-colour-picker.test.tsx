import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { TeamColourPicker } from '@/features/teams/team-colour-picker'
import { TEAM_PALETTE } from '@/features/teams/palette'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

describe('TeamColourPicker (S10.1 AC2, AC3)', () => {
  it('renders every palette swatch and marks the current one selected', async () => {
    const user = userEvent.setup()
    render(<TeamColourPicker colour={TEAM_PALETTE[0].value} teamName="Firsts" onPick={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Colour for Firsts/ }))

    for (const entry of TEAM_PALETTE) {
      expect(screen.getByRole('option', { name: entry.name })).toBeInTheDocument()
    }
    expect(screen.getByRole('option', { name: 'Blue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Red' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onPick with the chosen palette value', async () => {
    const green = TEAM_PALETTE.find((c) => c.name === 'Green')?.value
    expect(green).toBeDefined()
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(<TeamColourPicker colour={TEAM_PALETTE[0].value} teamName="Firsts" onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: /Colour for Firsts/ }))
    await user.click(screen.getByRole('option', { name: 'Green' }))

    expect(onPick).toHaveBeenCalledExactlyOnceWith(green)
  })

  it('is disabled while a save is in flight', () => {
    render(
      <TeamColourPicker
        colour={TEAM_PALETTE[0].value}
        teamName="Firsts"
        disabled
        onPick={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Colour for Firsts/ })).toBeDisabled()
  })
})
