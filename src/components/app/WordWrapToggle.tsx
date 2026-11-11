import { IconTextWrap } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { editorPrefs, toggleWordWrap } from '#/components/editor/word-wrap'
import { shortcuts } from '#/lib/shortcuts'
import { m } from '#/paraglide/messages'

/** Turns soft wrapping of long lines on or off in every editor. */
export function WordWrapToggle() {
  const on = useSelector(editorPrefs, (s) => s.wordWrap)
  return (
    <ToolbarButton
      label={m.word_wrap_toggle()}
      shortcut={shortcuts.wordWrap}
      size="icon-sm"
      aria-pressed={on}
      onClick={toggleWordWrap}
      className="text-muted-foreground aria-pressed:bg-sidebar-accent aria-pressed:text-foreground"
    >
      <IconTextWrap />
    </ToolbarButton>
  )
}
