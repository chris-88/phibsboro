import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface ReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Who it is about: "you" for the player's own answer, a name for the manager on-behalf. */
  subject: string
  /** Called once with the trimmed, non-empty reason when Save is tapped. */
  onSubmit: (reason: string) => void
  /** True while the write is in flight; the buttons disable. */
  pending?: boolean
}

/** The DB caps the reason at 200 chars (S18.4); the textarea matches so a manager can't overrun it. */
const MAX = 200

/**
 * The mandatory-reason prompt (S18.4). Shared by the player's own No (`AvailabilityButtons`) and the
 * manager on-behalf menu (`PlayerResponseCard`). Save stays disabled until something non-blank is
 * typed, so "unavailable" can never be recorded without a why — the same rule the DB check enforces.
 * Free text (Chris's choice): one box, no preset list.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  subject,
  onSubmit,
  pending = false,
}: ReasonDialogProps): React.JSX.Element {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  // Reset on every close, so the box is blank the next time it opens without an effect.
  const change = (next: boolean): void => {
    if (!next) setText('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why can&apos;t {subject} make it?</DialogTitle>
          <DialogDescription>A quick reason so the manager knows. Required.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          maxLength={MAX}
          rows={3}
          autoFocus
          aria-label="Reason"
          placeholder="e.g. Away with work this weekend"
          onChange={(e) => {
            setText(e.target.value)
          }}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              change(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={trimmed === '' || pending}
            onClick={() => {
              onSubmit(trimmed)
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
