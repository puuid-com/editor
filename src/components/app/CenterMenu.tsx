import { IconLayoutAlignCenter } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { editorPrefs } from '#/components/editor/word-wrap'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { applyCentered, centerables } from '#/lib/md-center'
import type { Centerable } from '#/lib/md-center'
import { m } from '#/paraglide/messages'

const labels: Record<Centerable, () => string> = {
  table: m.md_center_table,
  image: m.md_center_image,
  code: m.md_center_code,
  mermaid: m.md_center_mermaid,
}

function setCentered(kind: Centerable, on: boolean) {
  const centered = centerables.filter((k) =>
    k === kind ? on : editorPrefs.state.centered.includes(k),
  )
  editorPrefs.setState((s) => ({ ...s, centered }))
  applyCentered(centered)
}

/** Picks which Markdown blocks sit in the middle of the page, for every file. */
export function CenterMenu() {
  const centered = useSelector(editorPrefs, (s) => s.centered)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton label={m.md_center()}>
          <IconLayoutAlignCenter />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-auto">
        <DropdownMenuLabel>{m.md_center()}</DropdownMenuLabel>
        {centerables.map((kind) => (
          <DropdownMenuCheckboxItem
            key={kind}
            checked={centered.includes(kind)}
            onCheckedChange={(on) => setCentered(kind, on)}
            onSelect={(event) => event.preventDefault()}
          >
            {labels[kind]()}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
