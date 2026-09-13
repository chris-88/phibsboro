import { useEffect } from 'react'

/** Defined once. Every document title in the app ends with it (S0.3 AC13). */
export const TITLE_SUFFIX = ' · Phibsboro FC'

/** The 404 title, shared by the `*` route and the not-found branch of the error element. */
export const NOT_FOUND_TITLE = 'Nothing here.'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title + TITLE_SUFFIX
  }, [title])
}
