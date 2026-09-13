import { useParams } from 'react-router'

/** Thrown during render when a segment the route promised is not there. The route
 *  `errorElement` renders the 404 screen for this error and the error screen for any other. */
export class RouteParamMissingError extends Error {
  constructor(readonly param: string) {
    super(`Missing route param: ${param}`)
    this.name = 'RouteParamMissingError'
  }
}

/**
 * The only caller of `useParams()` in the codebase (S0.3 AC10). With
 * `noUncheckedIndexedAccess` on, `useParams().id` is `string | undefined`, and the tempting
 * fix is `params.id!`. This returns a plain `string` instead, and throws — not navigates,
 * which would warn during render — when the segment is absent.
 */
export function useRouteParam(name: string): string {
  const value = useParams()[name]
  if (value === undefined || value === '') throw new RouteParamMissingError(name)
  return value
}
