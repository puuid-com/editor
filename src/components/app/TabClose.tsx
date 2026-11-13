import { IconX } from '@tabler/icons-react'
import { closeTab } from './ui-store'
import { useUnsaved } from '#/hooks/use-unsaved'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

/**
 * A tab's close button. It shows on the active tab and on hover. A tab linked
 * to disk with unwritten changes keeps a dot there instead, which turns into
 * the close button on hover.
 */
export function TabClose({ file, active }: { file: TabFile; active: boolean }) {
  const unsaved = useUnsaved(file.id)
  return (
    <TabCloseButton
      label={m.tab_close({ name: file.name })}
      onClick={() => closeTab(file.id)}
      hidden={!active && !unsaved}
    >
      {unsaved ? (
        <>
          <span className="size-1.5 rounded-full bg-foreground md:group-hover/tab:hidden group-focus-visible/close:hidden" />
          <IconX className="hidden size-3 md:group-hover/tab:block group-focus-visible/close:block" />
        </>
      ) : (
        <IconX className="size-3" />
      )}
    </TabCloseButton>
  )
}

/** The close button's look, shared by file tabs and the settings tab. */
export function TabCloseButton({
  label,
  onClick,
  hidden,
  children = <IconX className="size-3" />,
}: {
  label: string
  onClick: () => void
  /** Shown only on hover, as on a tab that isn't picked. */
  hidden: boolean
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'group/close relative grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:after:-inset-3',
        hidden &&
          'max-md:hidden md:opacity-0 md:group-hover/tab:opacity-100 md:focus-visible:opacity-100',
      )}
    >
      {children}
    </button>
  )
}
