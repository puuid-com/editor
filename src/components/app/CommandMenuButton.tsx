import { IconSearch } from '@tabler/icons-react'

import { ToolbarButton } from './ToolbarButton'
import { setPaletteOpen } from './ui-store'
import { m } from '#/paraglide/messages'

/** Opens the command menu from a pane's header on phones, which have no sidebar rail. */
export function CommandMenuButton() {
  return (
    <ToolbarButton
      label={m.palette_open()}
      size="icon-sm"
      className="shrink-0 md:hidden"
      onClick={() => setPaletteOpen(true)}
    >
      <IconSearch />
    </ToolbarButton>
  )
}
