import { IconTypography } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ToolbarButton } from './ToolbarButton'
import { setCodeFont, setCodeSize } from '#/components/editor/code-font'
import { editorPrefs } from '#/components/editor/word-wrap'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { codeFonts, codeSizes, fontFace } from '#/lib/code-font'
import type { CodeFontId, CodeSize } from '#/lib/code-font'
import { m } from '#/paraglide/messages'

/** Picks the font and text size of the editor, for every file and profile. */
export function CodeFontMenu() {
  const current = useSelector(editorPrefs, (s) => s.codeFont)
  const size = useSelector(editorPrefs, (s) => s.codeSize)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          label={m.code_font()}
          size="icon-sm"
          className="text-muted-foreground"
        >
          <IconTypography />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-auto">
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{m.code_size()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(size)}
          onValueChange={(value) => setCodeSize(Number(value) as CodeSize)}
        >
          {codeSizes.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={String(option)}
              className="tabular-nums"
            >
              {m.code_size_px({ size: option })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
