import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle, toggleVariants } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/**
 * The 44px floor is `min-h-tap` / `size-tap` and nothing else (D40, A16). A control that
 * is deliberately taller uses Tailwind's own scale, so `min-h-12` and `size-12` also
 * clear the floor. `min-h-[44px]` and `min-h-11` are never written.
 */
const FLOOR = /(^|\s)(min-h-tap|size-tap|min-h-12|size-12)(\s|$)/

const expectClearsFloor = (className: string) => {
  expect(className).toMatch(FLOOR)
  expect(className).not.toMatch(/min-h-\[|min-h-11(\s|$)/)
}

// Every primitive a finger touches. Adding one here without an override fails the suite.
describe('touch primitives clear 44px at their default size (AC2)', () => {
  it('button', () => {
    render(<Button>Yes</Button>)
    expectClearsFloor(screen.getByRole('button', { name: 'Yes' }).className)
  })

  it('input', () => {
    render(<Input aria-label="Mobile number" />)
    expectClearsFloor(screen.getByLabelText('Mobile number').className)
  })

  it('select trigger', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Type">
          <SelectValue placeholder="Training" />
        </SelectTrigger>
      </Select>,
    )
    expectClearsFloor(screen.getByRole('combobox', { name: 'Type' }).className)
  })

  it('toggle', () => {
    render(<Toggle aria-label="Attended" />)
    expectClearsFloor(screen.getByRole('button', { name: 'Attended' }).className)
  })

  it('toggle-group item', () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="yes" aria-label="Attended" />
      </ToggleGroup>,
    )
    expectClearsFloor(screen.getByRole('radio', { name: 'Attended' }).className)
  })
})

describe('no size variant is allowed to be short (D40)', () => {
  const buttonSizes = [
    'default',
    'xs',
    'sm',
    'lg',
    'icon',
    'icon-xs',
    'icon-sm',
    'icon-lg',
  ] as const
  it.each(buttonSizes)('button size=%s', (size) => {
    expectClearsFloor(buttonVariants({ size }))
  })

  const toggleSizes = ['default', 'sm', 'lg'] as const
  it.each(toggleSizes)('toggle size=%s', (size) => {
    expectClearsFloor(toggleVariants({ size }))
  })
})
