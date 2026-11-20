import { IconArchive, IconKeyboard, IconSettings } from '@tabler/icons-react'

import { openSettings } from './settings-tab'
import { ToolbarButton } from './ToolbarButton'
import { setArchiveOpen, setShortcutsOpen } from './ui-store'
import { m } from '#/paraglide/messages'

// The sidebar footer's buttons. What they open loads the first time it shows.

/** Opens the list of recently deleted files. */
export function ArchiveButton() {
  return (
    <ToolbarButton
      label={m.archive_title()}
      size="icon-sm"
      className="text-muted-foreground"
      onClick={() => setArchiveOpen(true)}
    >
      <IconArchive />
    </ToolbarButton>
  )
}

/** Opens the settings tab. */
export function SettingsButton() {
  return (
    <ToolbarButton
      label={m.editor_settings()}
      size="icon-sm"
      className="text-muted-foreground"
      onClick={() => openSettings()}
    >
      <IconSettings />
    </ToolbarButton>
  )
}

/** Opens the list of every keyboard shortcut. */
export function ShortcutsButton() {
  return (
    <ToolbarButton
      label={m.shortcuts_title()}
      size="icon-sm"
      className="text-muted-foreground"
      onClick={() => setShortcutsOpen(true)}
    >
      <IconKeyboard />
    </ToolbarButton>
  )
}
