/**
 * Self-heal a stale code-split client after a deploy.
 *
 * With content-hashed chunks, a client that cached an old `index.html` can reference a chunk
 * hash the server no longer serves. The dynamic import then rejects with "Failed to fetch
 * dynamically imported module" and the screen would otherwise hang on its loading skeleton or
 * fall through to the error screen. The fix is to reload once so the browser fetches the fresh
 * index and its chunks.
 *
 * Guarded by `sessionStorage` so a genuinely missing chunk (a real 404, not a stale reference)
 * surfaces to the error screen on the second attempt instead of reloading forever.
 */

const RELOAD_FLAG = 'pfc.chunkReload'

/** The messages browsers use when a dynamic import cannot be fetched or parsed. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    /dynamically imported module/i.test(message) || // Chromium / Firefox
    /Importing a module script failed/i.test(message) || // Safari
    /error loading dynamically imported module/i.test(message)
  )
}

function reloadedThisSession(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1'
  } catch {
    // Private mode or blocked storage: treat as not-yet-reloaded, but the catch on set() below
    // means we still reload at most once because the second failure has no way to loop faster
    // than the page can. Erring toward one recovery attempt is correct.
    return false
  }
}

/**
 * Load a lazy route chunk, reloading once if the import fails because the chunk is stale.
 * Rethrows anything that is not a chunk-load error, and rethrows a chunk-load error that
 * survives one reload, so it reaches the route error screen rather than looping.
 */
export async function loadChunk<T>(
  load: () => Promise<T>,
  // Injectable because jsdom's location.reload cannot be spied on (matches registerServiceWorker).
  reload: () => void = () => {
    window.location.reload()
  },
): Promise<T> {
  try {
    const module = await load()
    // A clean load means the client is current; clear the guard so a future deploy can heal too.
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      // ignore
    }
    return module
  } catch (error) {
    if (isChunkLoadError(error) && !reloadedThisSession()) {
      try {
        sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch {
        // ignore — see reloadedThisSession()
      }
      reload()
      // Hold the promise open so React renders nothing new before the reload takes effect.
      await new Promise<never>(() => {
        // never resolves — the reload replaces the page
      })
    }
    throw error
  }
}
