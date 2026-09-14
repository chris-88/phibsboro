/**
 * A `fetch` that retries transient gateway failures, for the RLS suite against the free-tier
 * hosted project. A nano instance under a burst of load (a wipe + reseed + 267 assertions, plus
 * a deploy or a second run) occasionally answers 502/503/504, which is infrastructure latency,
 * not a policy result. Retrying those — and only those, never a 401/403/40x/42501 that the suite
 * legitimately asserts — keeps CI from flaking on the project's capacity rather than on the code.
 */
export function retryingFetch(maxRetries = 4, baseDelayMs = 400): typeof fetch {
  const transient = new Set([502, 503, 504])
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(input, init)
        if (transient.has(response.status) && attempt < maxRetries) {
          await sleep(baseDelayMs * 2 ** attempt)
          continue
        }
        return response
      } catch (error) {
        // A dropped connection to an overloaded gateway throws rather than returning a status.
        lastError = error
        if (attempt < maxRetries) {
          await sleep(baseDelayMs * 2 ** attempt)
          continue
        }
        throw error
      }
    }
    throw lastError
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
