import { IconDropletOff } from '@tabler/icons-react'
import type { MouseEvent } from 'react'

import { Hint } from './TableControls'
import { colorLabel } from '#/components/highlights/color-label'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { TooltipProvider } from '#/components/ui/tooltip'
import { HIGHLIGHT_PRESETS, highlightCss, isPreset } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'
import { m } from '#/paraglide/messages'

const keepFocus = (event: MouseEvent) => event.preventDefault()

/** The palette for a piece of inline code, and a way back to plain code. */
export function CodeColorPicker({
  value,
  onSelect,
}: {
  /** The code's colour: a preset, a CSS colour, or none for plain code. */
  value?: string
  onSelect: (color: HighlightPreset | null) => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label={m.md_code_color()}
        onMouseDown={keepFocus}
        className="flex items-center gap-0.5 p-0.5 font-sans"
      >
        <ToggleGroup
          type="single"
          spacing={0}
          aria-label={m.md_code_color()}
          value={value && isPreset(value) ? value : ''}
          onValueChange={(color) => {
            if (isPreset(color)) onSelect(color)
          }}
        >
          {HIGHLIGHT_PRESETS.map((color) => (
            <Hint key={color} label={colorLabel(color)}>
              <ToggleGroupItem
                value={color}
                aria-label={colorLabel(color)}
                className="size-6 min-w-6 p-0! aria-checked:bg-muted"
              >
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ backgroundColor: highlightCss(color) }}
                />
              </ToggleGroupItem>
            </Hint>
          ))}
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-0.5 h-4 self-center" />
        <Hint label={m.md_code_color_remove()}>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.md_code_color_remove()}
            disabled={!value}
            onClick={() => onSelect(null)}
          >
            <IconDropletOff />
          </Button>
        </Hint>
      </div>
    </TooltipProvider>
  )
}
