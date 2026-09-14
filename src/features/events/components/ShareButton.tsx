import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { copyText } from '@/lib/clipboard'
import { canShareNatively, shareBreadcrumb, shareText } from '@/lib/share'
import { waMeUrl } from '@/lib/shareMessage'

export interface ShareButtonProps {
  /** Pre-built during render (never inside the click handler), so the user gesture is still live
   *  when `navigator.share` runs (AC4). S5.1's `buildShareMessage` owns every character. */
  message: string
  /** "Share to WhatsApp" here; S5.3 passes its own. */
  label: string
  variant?: 'default' | 'secondary'
}

/**
 * The share control (S5.2): a shadcn `Button` rendering an anchor whose `href` is `waMeUrl()`, so
 * the no-`navigator.share` case is a plain link that no popup blocker can eat and that works with
 * JavaScript broken (AC3). Where a native share sheet exists, `handleClick` prevents that
 * navigation and hands the OS the message instead (AC2). One element, two behaviours.
 *
 * Beneath it, an always-present "Copy message" text-weight button (AC7). When `copyText()` returns
 * false — no Clipboard API, an insecure context, or a rejected write — it is replaced by a
 * read-only, self-selecting textarea holding the message (a single-line `<input>`, which the spec
 * names, strips the message's newlines), so the manager can long-press and copy by hand. Nothing
 * throws and nothing is logged on that path.
 */
export function ShareButton({ message, label, variant }: ShareButtonProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualCopy, setManualCopy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    // Only intercept when a native sheet is available; otherwise let the browser follow the href
    // so the tap is an ordinary navigation (AC3). No `await` runs before this decision (AC4).
    if (!canShareNatively()) return
    e.preventDefault()
    void (async () => {
      const outcome = await shareText(message)
      // Cancellation and success both clear the inline line and leave the button enabled (AC5).
      setFailed(outcome.status === 'failed')
    })()
  }

  async function onCopy(): Promise<void> {
    const ok = await copyText(message)
    if (ok) {
      shareBreadcrumb('clipboard')
      setCopied(true)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setCopied(false)
      }, 3000) // "Copied" for three seconds (AC7)
      return
    }
    // No clipboard, insecure context or a rejected write: swap in the manual-copy field (AC7).
    setManualCopy(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button asChild className="w-full" variant={variant ?? 'default'}>
        <a href={waMeUrl(message)} onClick={handleClick} rel="noopener noreferrer">
          {label}
        </a>
      </Button>

      {failed && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Couldn&apos;t open WhatsApp. Copy the message instead.
        </p>
      )}

      {manualCopy ? (
        <Textarea
          ref={inputRef}
          readOnly
          rows={5}
          value={message}
          aria-label="Share message"
          onFocus={(e) => {
            e.currentTarget.select()
          }}
        />
      ) : (
        <Button
          type="button"
          variant="link"
          className="self-start"
          aria-live="polite"
          onClick={() => {
            void onCopy()
          }}
        >
          {copied ? 'Copied' : 'Copy message'}
        </Button>
      )}
    </div>
  )
}
