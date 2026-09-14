import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/clipboard'

export interface CopyLinkFieldProps {
  /** The full absolute join URL, already built by `joinUrl(token)`. */
  url: string
  /** Announced label for the field and its manual-copy fallback. */
  label: string
  /** The idle button label. Defaults to "Copy"; S2.3's reset dialog passes "Copy link" (AC4). */
  copyLabel?: string
}

/**
 * The join link and its Copy button (S6.2). The URL renders in a `break-all` box so a 43-char
 * token plus the origin wraps at 375px rather than scrolling the page (AC14). Copy writes the
 * exact string and flips the button to a transient "Copied". When `navigator.clipboard` is
 * missing or refuses — the WhatsApp webview often does both — `copyText` returns false and the
 * box becomes a readonly input with its text selected under a "Copy this link" line, so the
 * manager can copy by hand. Nothing throws either way (AC4).
 */
export function CopyLinkField({
  url,
  label,
  copyLabel = 'Copy',
}: CopyLinkFieldProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  async function onCopy(): Promise<void> {
    const ok = await copyText(url)
    if (ok) {
      setCopied(true)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return
    }
    setManual(true)
    // The field is not yet mounted this tick; select it once it is, so a tap-and-hold copies.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {manual ? (
        <>
          <Input
            ref={inputRef}
            readOnly
            value={url}
            aria-label={label}
            className="break-all"
            onFocus={(e) => {
              e.currentTarget.select()
            }}
          />
          <p className="text-sm text-muted-foreground">Copy this link</p>
        </>
      ) : (
        <div
          aria-label={label}
          className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm break-all"
        >
          {url}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        aria-live="polite"
        onClick={() => {
          void onCopy()
        }}
      >
        {copied ? 'Copied' : copyLabel}
      </Button>
    </div>
  )
}
