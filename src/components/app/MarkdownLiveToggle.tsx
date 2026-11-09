import { IconEyeEdit } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { toggleMarkdownLive } from '#/components/markdown/md-live'
import { editorPrefs } from '#/components/editor/word-wrap'
import { m } from '#/paraglide/messages'

/** Renders Markdown in the editor itself, in place of the preview panel. */
export function MarkdownLiveToggle() {
  const on = useSelector(editorPrefs, (s) => s.markdownLive)
  return (
    <ToolbarButton
      label={m.md_live_toggle()}
      hint={m.md_live_hint()}
      size="xs"
      aria-pressed={on}
      onClick={toggleMarkdownLive}
      className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground max-md:size-auto max-md:h-11"
    >
      <IconEyeEdit />
      {m.md_live_toggle()}
    </ToolbarButton>
  )
}
