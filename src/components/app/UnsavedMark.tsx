import { useSelector } from '@tanstack/react-store'

import { useFileContent } from '#/hooks/use-files'
import { diskStore } from '#/lib/store/disk'
import { m } from '#/paraglide/messages'

/** A dot on a tab linked to a file on disk whose changes aren't written yet. */
export function UnsavedMark({ fileId }: { fileId: string }) {
  const saved = useSelector(diskStore, (links) => links[fileId]?.saved)
  if (saved === undefined) return null
  return <UnsavedDot fileId={fileId} saved={saved} />
}

// Apart from UnsavedMark so only linked tabs follow the content as it's typed.
function UnsavedDot({ fileId, saved }: { fileId: string; saved: string }) {
  const file = useFileContent(fileId)
  if (!file || file.content === saved) return null
  return (
    <span
      role="img"
      aria-label={m.tab_unsaved_disk()}
      className="size-1.5 shrink-0 rounded-full bg-foreground"
    />
  )
}
