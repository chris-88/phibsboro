/**
 * The only standalone check in the codebase (D44). The media query alone is wrong on iOS,
 * where a home-screen launch sets `navigator.standalone` and matches nothing.
 */
export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
