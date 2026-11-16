import { IconChevronUp } from '@tabler/icons-react'
import { useState } from 'react'

import { hlStyle } from './hl-style'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#/components/ui/popover'
import { useHighlights } from '#/hooks/use-highlights'
import { useTagCounts } from '#/hooks/use-tag-counts'
import { lazyPart } from '#/lib/lazy'
import { localName } from '#/lib/names'
import { shortcutLabel, shortcuts } from '#/lib/shortcuts'
import { groupByColor, highlightCss } from '#/lib/store/highlights'
import { m } from '#/paraglide/messages'
import type { Highlight } from '#/lib/store/highlights'

// Only the button shows with the editor; the legend loads when it opens.
const HighlightsLegend = lazyPart(() =>
  import('#/components/app/on-demand').then((mod) => mod.HighlightsLegend),
)

/**
 * The bottom bar's highlights: one button, with a dot per colour and the
 * match total, that opens the legend.
 */
export function HighlightsBar() {
  const rules = useHighlights()
  const [open, setOpen] = useState(false)
  // With no rules, only the open legend's suggestions need the counts.
  const counts = useTagCounts(open || rules.length > 0)
  const countOf = (rule: Highlight) => counts.get(localName(rule.tag)) ?? 0
  const present = rules.filter((r) => countOf(r) > 0)
  const groups = groupByColor(present)
  const total = present.reduce((sum, r) => sum + countOf(r), 0)

  return (
    <div className="contents">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 gap-1.5 px-1.5 text-[11px] font-normal text-foreground max-md:h-11"
            aria-label={m.highlights_title()}
          >
            {groups.length > 0 && (
              <span aria-hidden className="flex -space-x-0.5">
                {groups.slice(0, 6).map((group) => (
                  <span
                    key={group[0].id}
                    style={hlStyle(highlightCss(group[0].color))}
                    className="size-2 rounded-full bg-(--hl) ring-1 ring-background"
                  />
                ))}
              </span>
            )}
            {m.highlights_title()}
            {total > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {total}
              </span>
            )}
            <IconChevronUp className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-80 max-w-[calc(100vw-1rem)]"
        >
          <PopoverHeader>
            <PopoverTitle>{m.highlights_title()}</PopoverTitle>
            <PopoverDescription>
              {m.highlights_description()}
            </PopoverDescription>
          </PopoverHeader>
          <HighlightsLegend rules={rules} counts={counts} />
        </PopoverContent>
      </Popover>
      {rules.length === 0 && (
        <span className="ml-1 hidden min-w-0 truncate text-muted-foreground lg:inline">
          {m.highlights_hint_prefix()}{' '}
          <Kbd>{shortcutLabel(shortcuts.highlight)}</Kbd>{' '}
          {m.highlights_hint_suffix()}
        </span>
      )}
    </div>
  )
}
