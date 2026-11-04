import { IconSelector } from '@tabler/icons-react'

import { revealElement } from '#/components/editor/editor-store'
import { LeafText } from '#/components/inspector/LeafText'
import { InputGroupButton } from '#/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { leafValue } from '#/lib/xml/model'
import { displayPath, parentStep } from '#/lib/xml/locate'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { XmlElement } from '#/lib/xml/model'

export interface PinMatch {
  el: XmlElement
  /** Set when the value equals the default for this key. */
  defaultKey: string | undefined
  /** Whether the value differs from the default for this key. */
  differs: boolean
}

/**
 * The `2/5` beside a pinned field whose tag appears more than once. It opens
 * every occurrence with its position, parent and value; picking one moves the
 * cursor there, so the field edits that one.
 */
export function PinMatches({
  tag,
  matches,
  current,
}: {
  tag: string
  matches: ReadonlyArray<PinMatch>
  /** Index into `matches` of the occurrence the field edits. */
  current: number
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <InputGroupButton
          size="xs"
          aria-label={m.pin_matches({ name: tag, count: matches.length })}
          className="gap-0.5 px-1 text-muted-foreground tabular-nums max-md:h-11"
        >
          {current + 1}/{matches.length}
          <IconSelector className="size-3" />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-baseline justify-between gap-2 border-b bg-muted/50 px-3 py-2 font-mono">
          <span className="truncate text-[13px] text-syntax-tag">
            {`<${tag}>`}
          </span>
          <span className="shrink-0 font-sans text-muted-foreground">
            {m.pin_matches_count({ count: matches.length })}
          </span>
        </div>
        <ol className="max-h-72 overflow-auto p-1">
          {matches.map(({ el, defaultKey, differs }, index) => {
            const parent = parentStep(el.path)
            const selected = index === current
            return (
              <li key={el.path}>
                <button
                  type="button"
                  aria-current={selected || undefined}
                  title={displayPath(el.path).join(' › ')}
                  onClick={() => revealElement(el)}
                  className={cn(
                    'grid min-h-11 w-full grid-cols-[1.5rem_minmax(0,1fr)] items-baseline gap-x-2 px-2 py-1.5 text-left font-mono text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:min-h-0',
                    selected &&
                      'bg-accent/60 shadow-[inset_2px_0_var(--foreground)]',
                  )}
                >
                  <span className="text-right text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate">
                      <LeafText
                        value={leafValue(el)}
                        defaultKey={defaultKey}
                        differs={differs}
                      />
                    </span>
                    {parent && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {m.pin_match_parent({ parent })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </PopoverContent>
    </Popover>
  )
}
