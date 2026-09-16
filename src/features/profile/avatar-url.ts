import { supabase } from '@/lib/supabase'

/** The public URL for an avatar object path, or null for none (W10). Public bucket, so no signed
 *  URL: the path already carries a timestamp, so a new upload is a new URL (cache-bust). */
export function avatarUrl(path: string | null | undefined): string | null {
  if (path === null || path === undefined || path === '') return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** One or two initials from a name, for the fallback when there is no photo. */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (first === undefined || last === undefined) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}
