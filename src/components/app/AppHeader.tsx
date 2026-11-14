import {
  IconColumnsOff,
  IconDots,
  IconLayoutColumns,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { hidePane, joinPanes, MAX_PANES, openBeside } from './panes'
import { newFile, newZplFile } from './files'
import { askRename, setShareOpen } from './ui-store'
import { CommandMenuButton } from './CommandMenu'
import { TabStrip } from './TabStrip'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { SidebarTrigger } from '#/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { sessionStore, setActive, setPanelOpen } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'
import type { FilePaneGroup } from '#/lib/store/pane-layout'

/** One empty list, so the selector's result doesn't change on every read. */
const NO_PANES: Array<FilePaneGroup> = []

/**
 * One row per pane: its tabs and secondary file controls. The split action
 * stays on the leftmost pane and the close-pane button on the rightmost, so
 * neither moves as panes come and go.
 */
export function AppHeader({
  paneId,
  files,
  allFiles,
  fileId,
  active,
  count,
  first,
  last,
  wide,
  hasPanel,
  settings = false,
  settingsActive = false,
  actions,
  menuItems,
}: {
  paneId: string
  files: Array<TabFile>
  allFiles: Array<TabFile>
  fileId: string
  active: boolean
  count: number
  /** The leftmost pane on screen. */
  first: boolean
  /** The rightmost pane on screen. */
  last: boolean
  wide: boolean
  /** Whether the file type has a side panel to toggle. */
  hasPanel: boolean
  /** The settings tab sits in this pane. */
  settings?: boolean
  /** The settings tab is picked, in place of `fileId`. */
  settingsActive?: boolean
  /** The file type's own actions, before the split and ⋯ buttons. */
  actions?: React.ReactNode
  /** The file type's own entries at the end of the ⋯ menu. */
  menuItems?: React.ReactNode
}) {
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const panes = useSelector(sessionStore, (s) => s.panes ?? NO_PANES)
  const visible = new Set(panes.map((p) => p.activeId))
  const focus = () => setActive(fileId)

  return (
    <header className="flex h-12 shrink-0 items-center gap-0.5 border-b px-1.5 md:h-10">
      {/* Phones open the sidebar as a drawer from here. */}
      {first && (
        <SidebarTrigger className="shrink-0 text-muted-foreground max-md:size-11 md:hidden" />
      )}
      <TabStrip
        files={files}
        activeId={fileId}
        paneId={paneId}
        focused={active}
        settings={settings}
        settingsActive={settingsActive}
      />
      {actions}
      {first && <CommandMenuButton />}
      {wide && count > 1 && last && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={m.pane_close()}
              onClick={() => hidePane(paneId)}
            >
              <IconColumnsOff />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex flex-col">
            {m.pane_close()}
            <span className="opacity-70">{m.pane_close_hint()}</span>
          </TooltipContent>
        </Tooltip>
      )}
      {wide && first && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={m.pane_split()}
              disabled={count >= MAX_PANES}
              onClick={focus}
            >
              <IconLayoutColumns />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {allFiles
              .filter((f) => !visible.has(f.id))
              .map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => openBeside(f.id)}>
                  {f.name}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                focus()
                openBeside(newFile())
              }}
            >
              {m.file_new()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                focus()
                openBeside(newZplFile())
              }}
            >
              {m.file_new_zpl()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 max-md:size-11"
            aria-label={m.pane_actions()}
            onClick={focus}
          >
            <IconDots />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              focus()
              setShareOpen(true)
            }}
          >
            {m.share_button()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => askRename(fileId)}>
            {m.file_rename()}
          </DropdownMenuItem>
          {hasPanel && (
            <DropdownMenuCheckboxItem
              checked={panelOpen}
              onCheckedChange={setPanelOpen}
            >
              {m.action_toggle_panel()}
            </DropdownMenuCheckboxItem>
          )}
          {menuItems}
          {wide && count > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => hidePane(paneId)}>
                {m.pane_close()}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={joinPanes}>
                {m.pane_join()}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
