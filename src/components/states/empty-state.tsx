import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  title: string
  /** One line. If it needs two, the screen is doing too much. */
  body?: string
  /** A single control, usually the one thing the viewer can do next. */
  action?: React.ReactNode
}

/** Nothing to show, and that is not an error (D49). */
export function EmptyState({ title, body, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {body !== undefined && <p className="text-sm text-muted-foreground">{body}</p>}
      {action !== undefined && <div className="pt-2">{action}</div>}
    </div>
  )
}
