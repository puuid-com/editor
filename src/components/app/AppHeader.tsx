import {
  IconArrowsMinimize,
  IconDots,
  IconGripVertical,
  IconLayoutColumns,
  IconX,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import {
  MAX_PANES,
  hidePane,
  joinPanes,
  openBeside,
  setZoomed,
  swapPane,
} from './panes'
import { endPaneDrag, startPaneDrag } from './pane-drag'
import { PanelSideItems } from './PanelFrame'
import { ToolbarButton } from './ToolbarButton'
import { newFile, newZplFile } from './files'
import { askRename } from './ui-store'
import { CommandMenuButton } from './CommandMenuButton'
import { TabStrip } from './TabStrip'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { paneNeighbor } from '#/lib/store/pane-layout'
import type { FilePaneGroup, PaneEdge } from '#/lib/store/pane-layout'

/** One empty list, so the selector's result doesn't change on every read. */
const NO_PANES: Array<FilePaneGroup> = []

/** The ways a pane can trade places with the one beside it. */
const MOVES: ReadonlyArray<{ edge: PaneEdge; label: () => string }> = [
  { edge: 'left', label: m.edge_left },
  { edge: 'right', label: m.edge_right },
  { edge: 'top', label: m.direction_up },
  { edge: 'bottom', label: m.direction_down },
]

/**
 * One row per pane: a grip to drag it by, its tabs, its file's controls and
 * the button that closes it. The split action stays on the first pane, so it
 * doesn't move as panes come and go.
 */
export function AppHeader({
  paneId,
  files,
  allFiles,
  fileId,
  active,
  count,
  first,
  zoomed = false,
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
  /** The first pane on screen, in reading order. */
  first: boolean
  /** This pane shows alone, maximized over the others. */
  zoomed?: boolean
  wide: boolean
  /** Whether the file type has a side panel to toggle and move. */
  hasPanel: boolean
  /** The settings tab sits in this pane. */
  settings?: boolean
  /** The settings tab is picked, in place of `fileId`. */
  settingsActive?: boolean
  /** The file's actions, before the split and ⋯ buttons. */
  actions?: React.ReactNode
  /** The file type's own entries at the end of the ⋯ menu. */
  menuItems?: React.ReactNode
}) {
  // Several panes on screen, each of which can be moved, closed or maximized.
  const split = wide && count > 1
  const focus = () => setActive(fileId)

  return (
    <header className="flex h-12 shrink-0 items-center gap-0.5 border-b px-1.5 md:h-10">
      {/* Phones open the sidebar as a drawer from here. */}
      {first ? (
        <SidebarTrigger className="shrink-0 text-muted-foreground max-md:size-11 md:hidden" />
      ) : null}
      {split && !zoomed ? <PaneGrip paneId={paneId} /> : null}
      <TabStrip
        files={files}
        activeId={fileId}
        paneId={paneId}
        focused={active}
        settings={settings}
        settingsActive={settingsActive}
      />
      {actions}
      {first ? <CommandMenuButton /> : null}
      {wide && first && !zoomed ? (
        <SplitMenu allFiles={allFiles} count={count} onOpen={focus} />
      ) : null}
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
        <DropdownMenuContent align="end" className="w-56">
          <FileMenuItems
            fileId={fileId}
            hasPanel={hasPanel}
            movablePanel={wide && hasPanel}
          />
          {menuItems}
          {split ? <PaneMenuItems paneId={paneId} zoomed={zoomed} /> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {split ? (
        <PaneEndButton paneId={paneId} zoomed={zoomed} count={count} />
      ) : null}
    </header>
  )
}

/** The grip a pane is dragged by to another place on screen. */
function PaneGrip({ paneId }: { paneId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          draggable
          aria-hidden
          className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing [&_svg]:size-3.5"
          onDragStart={(e) => {
            const header = e.currentTarget.closest('header')
            if (header) e.dataTransfer.setDragImage(header, 12, 12)
            startPaneDrag(e, { kind: 'pane', id: paneId })
          }}
          onDragEnd={endPaneDrag}
        >
          <IconGripVertical />
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col">
        {m.pane_move()}
        <span className="opacity-70">{m.pane_drag_hint()}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Opens a file not on screen, or a new one, in a pane beside this one. */
function SplitMenu({
  allFiles,
  count,
  onOpen,
}: {
  allFiles: Array<TabFile>
  count: number
  onOpen: () => void
}) {
  const panes = useSelector(sessionStore, (s) => s.panes ?? NO_PANES)
  const visible = new Set(panes.map((p) => p.activeId))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={m.pane_split()}
          disabled={count >= MAX_PANES}
          onClick={onOpen}
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
            onOpen()
            openBeside(newFile())
          }}
        >
          {m.file_new()}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onOpen()
            openBeside(newZplFile())
          }}
        >
          {m.file_new_zpl()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The ⋯ menu's entries for the file: rename and its panel. */
function FileMenuItems({
  fileId,
  hasPanel,
  movablePanel,
}: {
  fileId: string
  hasPanel: boolean
  movablePanel: boolean
}) {
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  return (
    <>
      <DropdownMenuItem onSelect={() => askRename(fileId)}>
        {m.file_rename()}
      </DropdownMenuItem>
      {hasPanel ? (
        <DropdownMenuCheckboxItem
          checked={panelOpen}
          onCheckedChange={setPanelOpen}
        >
          {m.action_toggle_panel()}
        </DropdownMenuCheckboxItem>
      ) : null}
      {movablePanel ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{m.panel_position()}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <PanelSideItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </>
  )
}

/** The ⋯ menu's entries for a pane among several: maximize, move, close, join. */
function PaneMenuItems({
  paneId,
  zoomed,
}: {
  paneId: string
  zoomed: boolean
}) {
  const layout = useSelector(sessionStore, (s) => s.layout)
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked={zoomed} onCheckedChange={setZoomed}>
        {m.pane_maximize()}
      </DropdownMenuCheckboxItem>
      {!zoomed ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{m.pane_move()}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MOVES.map((move) => (
              <DropdownMenuItem
                key={move.edge}
                disabled={!paneNeighbor(layout, paneId, move.edge)}
                onSelect={() => swapPane(paneId, move.edge)}
              >
                {move.label()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
      <DropdownMenuItem onSelect={() => hidePane(paneId)}>
        {m.pane_close()}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={joinPanes}>{m.pane_join()}</DropdownMenuItem>
    </>
  )
}

/** Closes the pane, or brings the others back while it is maximized. */
function PaneEndButton({
  paneId,
  zoomed,
  count,
}: {
  paneId: string
  zoomed: boolean
  count: number
}) {
  return zoomed ? (
    <ToolbarButton
      label={m.pane_restore()}
      hint={m.pane_restore_hint({ count })}
      size="icon-sm"
      className="shrink-0"
      onClick={() => setZoomed(false)}
    >
      <IconArrowsMinimize />
    </ToolbarButton>
  ) : (
    <ToolbarButton
      label={m.pane_close()}
      hint={m.pane_close_hint()}
      size="icon-sm"
      className="shrink-0"
      onClick={() => hidePane(paneId)}
    >
      <IconX />
    </ToolbarButton>
  )
}
