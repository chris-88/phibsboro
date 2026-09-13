import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/components/app-shell'
import { VersionTag } from '@/components/version-tag'

function setRelease(content: string | undefined) {
  document.querySelector('meta[name="pfc-release"]')?.remove()
  if (content === undefined) return
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'pfc-release')
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

describe('<VersionTag /> (AC15, AC16)', () => {
  afterEach(() => {
    setRelease(undefined)
  })

  it('renders the short SHA, muted and small', () => {
    setRelease('0123456789abcdef')
    render(<VersionTag />)
    const tag = screen.getByTestId('version-tag')
    expect(tag).toHaveTextContent('0123456')
    expect(tag.className).toContain('text-xs')
    expect(tag.className).toContain('text-muted-foreground')
  })

  it("renders 'local' in development", () => {
    setRelease('%VITE_SENTRY_RELEASE%')
    render(<VersionTag />)
    expect(screen.getByTestId('version-tag')).toHaveTextContent('local')
  })

  it('renders differently for two builds with different releases', () => {
    setRelease('build-a')
    const a = render(<VersionTag />)
    const textA = a.getByTestId('version-tag').textContent
    a.unmount()
    setRelease('build-b')
    const b = render(<VersionTag />)
    expect(b.getByTestId('version-tag').textContent).not.toBe(textA)
  })

  it.each(['nav', 'bare'] as const)(
    'sits in flow at the foot of the %s shell, never fixed, so it covers nothing',
    (chrome) => {
      setRelease('0123456789abcdef')
      const { container } = render(
        <MemoryRouter>
          <AppShell chrome={chrome} role="player" currentPath="/">
            <button type="button">YES</button>
          </AppShell>
        </MemoryRouter>,
      )
      const tag = screen.getByTestId('version-tag')
      const footer = tag.closest('footer')
      expect(footer).not.toBeNull()
      expect(footer?.className).not.toMatch(/\b(fixed|absolute|sticky)\b/)
      expect(tag.className).not.toMatch(/\b(fixed|absolute|sticky)\b/)
      // Below the content, above the nav: the YES button precedes it in document order.
      const yes = screen.getByRole('button', { name: 'YES' })
      expect(yes.compareDocumentPosition(tag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      const nav = container.querySelector('nav')
      if (nav)
        expect(tag.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // Nothing pinned wider than 375px anywhere in the footer.
      expect(footer?.className).not.toMatch(/\bw-\[\d{3,}px\]|\bmin-w-\[\d{3,}px\]/)
    },
  )
})
