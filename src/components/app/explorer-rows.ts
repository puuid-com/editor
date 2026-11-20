// Row styles and behaviour every workspace of the explorer shares.

/** A tree row owns its hover and selected colors; the buttons inside stay flat. */
export const rowClass =
  'group/row flex min-w-0 items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground has-[[aria-haspopup=menu][aria-expanded=true]]:bg-sidebar-accent has-[[aria-haspopup=menu][aria-expanded=true]]:text-foreground'
export const rowButtonClass =
  'h-8 min-w-0 flex-1 justify-start px-2 font-normal hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit md:h-7 dark:hover:bg-transparent'
/** The selected row: the file in the editor. */
export const activeRowClass =
  'bg-sidebar-accent text-foreground hover:bg-sidebar-accent'
/** What a folder or workspace holds, set in from its row along a guide line. */
export const nestClass = 'ml-3.5 border-l border-sidebar-border pl-1.5'

/** Set on the selected row, so the explorer scrolls to it as it opens. */
export function scrollToRow(node: HTMLElement | null) {
  node?.scrollIntoView({ block: 'nearest' })
}
