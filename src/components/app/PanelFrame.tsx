import {
  IconLayoutBottombar,
  IconLayoutNavbar,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconX,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { editorPrefs, setPanelSide } from '#/components/editor/word-wrap'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { PANEL_SIDES } from '#/lib/panel-side'
import { panelSideLabel } from './panel-side-label'
import { shortcuts } from '#/lib/shortcuts'
import { setPanelOpen } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import type { PanelSide } from '#/lib/panel-side'
import type { PaneEdge } from '#/lib/store/pane-layout'

const EDGE_ICON = {
  right: IconLayoutSidebarRight,
  bottom: IconLayoutBottombar,
  left: IconLayoutSidebar,
  top: IconLayoutNavbar,
} satisfies Record<PaneEdge, unknown>

/** The places the side panel can sit, as a dropdown menu's radio items. */
export function PanelSideItems() {
  const side = useSelector(editorPrefs, (s) => s.panelSide)
  return (
    <DropdownMenuRadioGroup
      value={side}
      onValueChange={(value) => setPanelSide(value as PanelSide)}
    >
      {PANEL_SIDES.map((option) => (
        <DropdownMenuRadioItem key={option} value={option}>
          {panelSideLabel(option)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

/**
 * A side panel under its bar: what it shows, where it sits and the button
 * that closes it. Phones have no room for the bar; the pane's menu closes
 * the panel there.
 */
export function PanelFrame({
  title,
  edge,
  children,
}: {
  title: string
  /** The edge of the code the panel sits on now. */
  edge: PaneEdge
  children: React.ReactNode
}) {
  const Edge = EDGE_ICON[edge]
  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b pr-1.5 pl-3 max-md:hidden">
        <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {title}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={m.panel_position()}
            >
              <Edge />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PanelSideItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarButton
          label={m.panel_close()}
          shortcut={shortcuts.togglePanel}
          onClick={() => setPanelOpen(false)}
        >
          <IconX />
        </ToolbarButton>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
