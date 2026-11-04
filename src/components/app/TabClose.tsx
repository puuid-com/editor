import { IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { askClose } from './ui-store'
import { useFileContent } from '#/hooks/use-files'
import { diskStore } from '#/lib/store/disk'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

/**
 * A tab's close button. It shows on the active tab and on hover. A tab linked
 * to disk with unwritten changes keeps a dot there instead, which turns into
 * the close button on hover.
 */
export function TabClose({ file, active }: { file: TabFile; active: boolean }) {
  const saved = useSelector(diskStore, (links) => links[file.id]?.saved)
  if (saved === undefined) return <CloseButton file={file} active={active} />
  return <LinkedClose file={file} active={active} saved={saved} />
}

// Apart from TabClose so only linked tabs follow the content as it's typed.
function LinkedClose({
  file,
  active,
  saved,
}: {
  file: TabFile
  active: boolean
  saved: string
}) {
  const content = useFileContent(file.id)
  const unsaved = !!content && content.content !== saved
  return <CloseButton file={file} active={active} unsaved={unsaved} />
}

function CloseButton({
  file,
  active,
  unsaved = false,
}: {
  file: TabFile
  active: boolean
  unsaved?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={m.tab_close({ name: file.name })}
      onClick={() => askClose(file.id)}
      className={cn(
        'group/close relative grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:after:-inset-3',
        !active &&
          !unsaved &&
          'max-md:hidden md:opacity-0 md:group-hover/tab:opacity-100 md:focus-visible:opacity-100',
      )}
    >
      {unsaved ? (
        <>
          <span className="size-1.5 rounded-full bg-foreground md:group-hover/tab:hidden group-focus-visible/close:hidden" />
          <IconX className="hidden size-3 md:group-hover/tab:block group-focus-visible/close:block" />
        </>
      ) : (
        <IconX className="size-3" />
      )}
    </button>
  )
}
