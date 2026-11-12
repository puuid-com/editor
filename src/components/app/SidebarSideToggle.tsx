import { IconLayoutSidebar, IconLayoutSidebarRight } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { editorPrefs, toggleSidebarSide } from '#/components/editor/word-wrap'
import { m } from '#/paraglide/messages'

/** Moves the sidebar to the other side of the sheet; the icon shows where. */
export function SidebarSideToggle() {
  const right = useSelector(editorPrefs, (s) => s.sidebarRight)
  return (
    <ToolbarButton
      label={right ? m.sidebar_move_left() : m.sidebar_move_right()}
      size="icon-sm"
      className="text-muted-foreground"
      onClick={toggleSidebarSide}
    >
      {right ? <IconLayoutSidebar /> : <IconLayoutSidebarRight />}
    </ToolbarButton>
  )
}
