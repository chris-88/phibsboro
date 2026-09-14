import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia. D44's isStandalone() helper calls it, and so does anything
// Tailwind-adjacent that asks about a media query, so stub it once here. jsdom 30 declares
// the property but leaves it undefined, so `'matchMedia' in window` is true and useless.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
}

// jsdom has no layout, so scrollTo logs "Not implemented" instead of scrolling. React
// Router's <ScrollRestoration> calls it on every navigation; make it a no-op.
window.scrollTo = () => undefined

// jsdom has no ResizeObserver. Radix primitives (the Switch on the recurring-training form, and
// others) construct one on mount, so the state harness that renders whole screens needs it stubbed
// once here. A no-op observer is enough — nothing under test asserts a resize.
if (typeof globalThis.ResizeObserver !== 'function') {
  const noop = (): void => undefined
  globalThis.ResizeObserver = class {
    observe = noop
    unobserve = noop
    disconnect = noop
  }
}

// S7.1 AC6 — a floating promise rejection fails the run instead of printing and passing. Every
// genuine fire-and-forget in the app is written `void promise` and cannot reject unhandled; the
// query stubs settle or hang, they never reject. This turns any real leak red.
process.on('unhandledRejection', (reason) => {
  throw reason instanceof Error ? reason : new Error(String(reason))
})
