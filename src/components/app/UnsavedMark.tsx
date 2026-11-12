import { useUnsaved } from '#/hooks/use-unsaved'
import { m } from '#/paraglide/messages'

/**
 * A dot on a tab linked to a file on disk whose changes aren't written yet.
 * `srOnly` keeps it for screen readers where something else draws the dot.
 */
export function UnsavedMark({
  fileId,
  srOnly,
}: {
  fileId: string
  srOnly?: boolean
}) {
  if (!useUnsaved(fileId)) return null
  return (
    <span
      role="img"
      aria-label={m.tab_unsaved_disk()}
      className={
        srOnly ? 'sr-only' : 'size-1.5 shrink-0 rounded-full bg-foreground'
      }
    />
  )
}
