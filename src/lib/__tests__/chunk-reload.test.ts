import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadChunk } from '@/lib/chunk-reload'

describe('loadChunk', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns the module on a clean load', async () => {
    const mod = { default: 'Screen' }
    await expect(loadChunk(() => Promise.resolve(mod))).resolves.toBe(mod)
  })

  it('reloads once when a stale chunk fails to import, then rethrows on the second failure', async () => {
    const reload = vi.fn()
    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/x.js')

    // First failure: reloads and never resolves (the page is reloading).
    let settled = false
    void loadChunk(() => Promise.reject(chunkError), reload).then(
      () => (settled = true),
      () => (settled = true),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    expect(sessionStorage.getItem('pfc.chunkReload')).toBe('1')

    // Second failure in the same session (post-reload guard set): rethrows, no further reload.
    await expect(loadChunk(() => Promise.reject(chunkError), reload)).rejects.toThrow(chunkError)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('rethrows a non-chunk error without reloading', async () => {
    const reload = vi.fn()
    const other = new Error('some app error')
    await expect(loadChunk(() => Promise.reject(other), reload)).rejects.toThrow(other)
    expect(reload).not.toHaveBeenCalled()
  })

  it('clears the guard after a clean load so a later deploy can heal again', async () => {
    sessionStorage.setItem('pfc.chunkReload', '1')
    await loadChunk(() => Promise.resolve({ ok: true }))
    expect(sessionStorage.getItem('pfc.chunkReload')).toBeNull()
  })

  it('recognises the Safari and Firefox phrasings too', async () => {
    const reload = vi.fn()
    void loadChunk(() => Promise.reject(new Error('Importing a module script failed.')), reload)
    await Promise.resolve()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
