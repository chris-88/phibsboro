import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/clipboard'
import { absoluteUrl, paths } from '@/lib/paths'
import { dismiss } from '@/lib/prompt-dismissal'

export interface EscapePromptProps {
  platform: 'ios-inapp' | 'android-inapp'
  /** The gate re-reads `localStorage` when this fires, so a dismiss removes the prompt at once. */
  onDismiss: () => void
}

/**
 * The one line that gets a trapped player out of the WhatsApp webview and into a browser that can
 * install (S2.7). Inline in the flow — a shadcn `Card` with `role="status"`, never a `Dialog` or a
 * `Sheet` (AC5): a modal would steal focus and cover the YES / NO the player just used. It never
 * gates the response; by the time it renders, the answer is already saved (AC4).
 *
 * The copy admits the cost the escape hatch carries (D47): the player lands in a fresh browser with
 * no session and signs in once more. The button copies the app root, not the event URL, so they
 * land on sign-in and then home, having already answered. No session transfer is attempted — none
 * is possible between browsers.
 */
export function EscapePrompt({ platform, onDismiss }: EscapePromptProps): React.JSX.Element {
  const browser = platform === 'ios-inapp' ? 'Safari' : 'Chrome'
  const url = absoluteUrl(paths.home())
  const [copied, setCopied] = useState(false)
  const [manualCopy, setManualCopy] = useState(false)

  const onCopy = async (): Promise<void> => {
    // copyText never throws: false means no Clipboard API, an insecure context, or a rejected
    // write — precisely the in-app webviews this prompt exists for. Fall back to a select-it field.
    if (await copyText(url)) {
      setCopied(true)
      return
    }
    setManualCopy(true)
  }

  const handleDismiss = (): void => {
    dismiss('escape')
    onDismiss()
  }

  return (
    <Card role="status" className="mt-4">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground">
          Open in {browser} to add this to your home screen. You&apos;ll sign in once more.
        </p>

        <div className="flex items-center justify-between gap-2">
          {!manualCopy && (
            <Button
              type="button"
              variant="outline"
              aria-live="polite"
              onClick={() => {
                void onCopy()
              }}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Not now"
            className="ml-auto"
            onClick={handleDismiss}
          >
            <XIcon />
          </Button>
        </div>

        {copied && !manualCopy && (
          <p className="text-sm text-muted-foreground">Paste it into {browser}.</p>
        )}

        {manualCopy && (
          <div className="flex flex-col gap-2">
            <Input
              readOnly
              value={url}
              aria-label="App link"
              onFocus={(e) => {
                e.currentTarget.select()
              }}
            />
            <p className="text-sm text-muted-foreground">
              Copy didn&apos;t work. Tap and hold the link to copy it.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
