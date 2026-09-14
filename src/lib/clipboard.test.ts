import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '@/lib/clipboard'

const setClipboard = (value: Clipboard | undefined): void => {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  setClipboard(undefined)
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('writes the text and returns true when the Clipboard API succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText } as unknown as Clipboard)
    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('returns false, without throwing, when there is no Clipboard API', async () => {
    setClipboard(undefined)
    await expect(copyText('hello')).resolves.toBe(false)
  })

  it('returns false, without throwing, when writeText rejects (an insecure webview)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    setClipboard({ writeText } as unknown as Clipboard)
    await expect(copyText('hello')).resolves.toBe(false)
  })
})
