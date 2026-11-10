import { IconTypography } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { setCodeFont } from '#/components/editor/code-font'
import { editorPrefs } from '#/components/editor/word-wrap'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { codeFonts, fontFace } from '#/lib/code-font'
import type { CodeFontId } from '#/lib/code-font'
import { m } from '#/paraglide/messages'

/** Picks the font of the editor and code, for every file and profile. */
export function CodeFontMenu() {
  const current = useSelector(editorPrefs, (s) => s.codeFont)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton label={m.code_font()}>
          <IconTypography />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-auto">
        <DropdownMenuLabel>{m.code_font()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(id) => void setCodeFont(id as CodeFontId)}
        >
          {codeFonts.map((font) => (
            <DropdownMenuRadioItem
              key={font.id}
              value={font.id}
              style={{ fontFamily: fontFace(font) }}
            >
              {font.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
