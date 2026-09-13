import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia. D44's isStandalone() helper calls it, and so does anything
// Tailwind-adjacent that asks about a media query, so stub it once here.
if (!('matchMedia' in window)) {
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
