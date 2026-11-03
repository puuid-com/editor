import { IconDots, IconLayoutColumns } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { hidePane, MAX_PANES, openBeside } from './panes'
import { newFile, newZplFile } from './files'
import { askRename, setShareOpen } from './ui-store'
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
import { sessionStore, setActive, setPanelOpen } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'

/** One row per pane: its tabs, split action and secondary file controls. */
export function AppHeader({
  paneId,
  files,
  allFiles,
  fileId,
  active,
  count,
  wide,
  structured,
  actions,
  menuItems,
}: {
  paneId: string
  files: Array<TabFile>
  allFiles: Array<TabFile>
  fileId: string
  active: boolean
  count: number
  wide: boolean
  structured: boolean
  /** The file type's own actions, before the split and ⋯ buttons. */
  actions?: React.ReactNode
  /** The file type's own entries at the end of the ⋯ menu. */
  menuItems?: React.ReactNode
}) {
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const panes = useSelector(sessionStore, (s) => s.panes ?? [])
  const visible = panes.map((p) => p.activeId)
  const focus = () => setActive(fileId)

  return (
    <header className="flex h-12 shrink-0 items-center border-b bg-background md:h-10">
      <TabStrip
        files={files}
        activeId={fileId}
        paneId={paneId}
        focused={active}
      />
      {actions}
      {wide && (
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
              .filter((f) => !visible.includes(f.id))
              .map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => openBeside(f.id)}>
                  {f.name}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                focus()
                newFile()
                const id = sessionStore.state.activeId
                if (id) openBeside(id)
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
            className="mr-1 shrink-0"
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
          {structured && (
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
