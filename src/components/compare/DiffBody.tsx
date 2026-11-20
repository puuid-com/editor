import {
  IconArrowsVertical,
  IconFoldDown,
  IconFoldUp,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useImperativeHandle, useRef } from 'react'

import { editorPrefs } from '#/components/editor/word-wrap'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { REVEAL_STEP, hunkLabel } from '#/lib/diff'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { SideSyntax } from './highlight'
import type { DiffLayout } from '#/components/editor/word-wrap'
import type { DiffLine, DiffRow, DiffRows, Reveal } from '#/lib/diff'
import type { Ref } from 'react'

/** Moving between changes, for the bar above and its shortcuts. */
export interface DiffNavigation {
  next: () => void
  previous: () => void
}

const ROW_TONE = {
  context: '',
  add: 'bg-(--hl-green)/10',
  del: 'bg-(--destructive)/8',
}
const NUMBER_TONE = {
  context: 'text-(--syntax-gutter)',
  add: 'bg-(--hl-green)/18 text-foreground/70',
  del: 'bg-(--destructive)/14 text-foreground/70',
}
const MARK_TONE = {
  context: '',
  add: 'rounded-xs bg-(--hl-green)/35',
  del: 'rounded-xs bg-(--destructive)/28',
}
const SIGN = { context: ' ', add: '+', del: '-' }
const ZERO_WIDTH = String.fromCharCode(0x200b)
const SIGN_TONE = {
  context: '',
  add: 'text-(--hl-green)',
  del: 'text-destructive',
}

/** A stable key per row, so measured heights follow rows as folds open. */
function rowKey(row: DiffRow) {
  if (row.type === 'gap') return `g${row.gap}`
  if (row.type === 'line') return `${row.line.kind}${row.line.a}:${row.line.b}`
  return `p${row.left?.a ?? '-'}:${row.right?.b ?? '-'}`
}

/**
 * The comparison's lines, as GitHub shows a file's changes: hunks under
 * their `@@` header, removed and added lines tinted and signed, both line
 * numbers in the margin, and folds that open on unchanged lines.
 */
export function DiffBody({
  diff,
  a,
  b,
  syntaxA,
  syntaxB,
  layout,
  wrap,
  label,
  onReveal,
  navRef,
}: {
  diff: DiffRows
  a: ReadonlyArray<string>
  b: ReadonlyArray<string>
  syntaxA: SideSyntax
  syntaxB: SideSyntax
  layout: DiffLayout
  /** Long lines wrap; split always wraps, since each side is half as wide. */
  wrap: boolean
  label: string
  onReveal: (gap: number, way: Reveal) => void
  navRef: Ref<DiffNavigation>
}) {
  const { rows, changeRows } = diff
  const scrollRef = useRef<HTMLDivElement>(null)
  const size = useSelector(editorPrefs, (s) => s.codeSize)
  const lineHeight = Math.round(size * 1.65)
  const wraps = wrap || layout === 'split'

  // TanStack Virtual is a known React Compiler opt-out; rows get only plain
  // values and stable objects, so they still skip renders while scrolling.
  // react-doctor-disable-next-line react-hooks-js/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i].type === 'gap' ? lineHeight + 8 : lineHeight),
    getItemKey: (i) => rowKey(rows[i]),
    overscan: 24,
  })
  // Each row is measured as it mounts and watched after, so wrapping and
  // text size changes re-measure on their own.
  // Keys work at once: arrows and Page Down scroll, F7 moves on.
  useEffect(() => scrollRef.current?.focus({ preventScroll: true }), [])

  // The change last moved to, while it's still on screen; once scrolled
  // away, the next one counts from where the view is.
  const current = useRef(-1)
  const go = (step: 1 | -1) => {
    const count = changeRows.length
    if (!count) return
    const top = virtualizer.range?.startIndex ?? 0
    const bottom = virtualizer.range?.endIndex ?? 0
    const shown = (k: number) =>
      k >= 0 && k < count && changeRows[k] >= top && changeRows[k] <= bottom
    let target: number
    if (shown(current.current)) target = current.current + step
    else if (step > 0) target = changeRows.findIndex((row) => row > top)
    else target = changeRows.filter((row) => row < top).length - 1
    if (target < 0 && step > 0) target = 0
    target = (target + count) % count
    current.current = target
    // A couple of lines above it, so it reads in context.
    virtualizer.scrollToIndex(Math.max(0, changeRows[target] - 2), {
      align: 'start',
    })
  }
  useImperativeHandle(navRef, () => ({
    next: () => go(1),
    previous: () => go(-1),
  }))

  const digits = String(Math.max(diff.lastLine, 99)).length
  const numbers = layout === 'split' ? 1 : 2
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-auto font-mono outline-none [tab-size:4] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      style={
        {
          fontSize: size,
          lineHeight: `${lineHeight}px`,
          '--num': `calc(${digits}ch + 1.25rem)`,
        } as React.CSSProperties
      }
    >
      <div
        className="relative"
        style={{
          height: virtualizer.getTotalSize(),
          // Rows that don't wrap all take the longest line's width, so their
          // tints run to the same edge when scrolled sideways.
          minWidth: wraps
            ? undefined
            : `calc(${diff.widest}ch + ${numbers} * var(--num) + 4ch)`,
        }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {row.type === 'gap' ? (
                <GapRow
                  gap={row.gap}
                  hidden={row.hidden}
                  label={row.header ? hunkLabel(row.header) : ''}
                  reveals={row.reveals}
                  numbers={numbers}
                  onReveal={onReveal}
                />
              ) : row.type === 'line' ? (
                <UnifiedRow
                  line={row.line}
                  text={row.line.kind === 'del' ? a[row.line.a] : b[row.line.b]}
                  syntax={row.line.kind === 'del' ? syntaxA : syntaxB}
                  wrap={wraps}
                />
              ) : (
                <div className="grid grid-cols-2">
                  <Half
                    line={row.left}
                    text={row.left ? a[row.left.a] : ''}
                    side="a"
                    syntax={syntaxA}
                  />
                  <Half
                    line={row.right}
                    text={row.right ? b[row.right.b] : ''}
                    side="b"
                    syntax={syntaxB}
                    className="border-l"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const REVEAL_ICON = {
  up: IconFoldUp,
  down: IconFoldDown,
  all: IconArrowsVertical,
}

function revealLabel(way: Reveal, hidden: number) {
  if (way === 'all') return m.compare_reveal_all({ count: hidden })
  const count = Math.min(REVEAL_STEP, hidden)
  return way === 'up'
    ? m.compare_reveal_up({ count })
    : m.compare_reveal_down({ count })
}

/** The fold before a hunk: its header, and buttons to open what it hides. */
function GapRow({
  gap,
  hidden,
  label,
  reveals,
  numbers,
  onReveal,
}: {
  gap: number
  hidden: number
  label: string
  reveals: ReadonlyArray<Reveal>
  numbers: 1 | 2
  onReveal: (gap: number, way: Reveal) => void
}) {
  return (
    <div className="flex min-h-[calc(1lh+0.5rem)] items-stretch bg-muted/70 text-muted-foreground">
      <div
        className="flex shrink-0 flex-col items-center justify-center bg-muted py-0.5"
        style={{ width: `calc(${numbers} * var(--num) + 2ch)` }}
      >
        {reveals.map((way) => {
          const Icon = REVEAL_ICON[way]
          return (
            <Tooltip key={way}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={revealLabel(way, hidden)}
                  className="h-5 w-8 rounded-sm max-md:h-9 max-md:w-11"
                  onClick={() => onReveal(gap, way)}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{revealLabel(way, hidden)}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex min-w-0 items-center gap-3 px-3 py-1">
        <span className="whitespace-pre">{label}</span>
        {hidden > 0 && (
          <span className="truncate font-sans text-[11px]">
            {m.compare_unchanged_lines({ count: hidden })}
          </span>
        )}
      </div>
    </div>
  )
}

/** One line of the unified view: both numbers, its sign and its text. */
function UnifiedRow({
  line,
  text,
  syntax,
  wrap,
}: {
  line: DiffLine
  text: string
  syntax: SideSyntax
  wrap: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[var(--num)_var(--num)_2ch_minmax(0,1fr)]',
        ROW_TONE[line.kind],
      )}
    >
      <LineNumber line={line} side="a" />
      <LineNumber line={line} side="b" />
      <Sign line={line} />
      <Code
        line={line}
        index={line.kind === 'del' ? line.a : line.b}
        text={text}
        syntax={syntax}
        wrap={wrap}
      />
    </div>
  )
}

/** One side of a split row; a blank where the other side has a line alone. */
function Half({
  line,
  text,
  side,
  syntax,
  className,
}: {
  line: DiffLine | null
  text: string
  side: 'a' | 'b'
  syntax: SideSyntax
  className?: string
}) {
  if (!line) return <div aria-hidden className={cn('bg-muted/50', className)} />
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[var(--num)_2ch_minmax(0,1fr)]',
        ROW_TONE[line.kind],
        className,
      )}
    >
      <LineNumber line={line} side={side} />
      <Sign line={line} />
      <Code
        line={line}
        index={side === 'a' ? line.a : line.b}
        text={text}
        syntax={syntax}
        wrap
      />
    </div>
  )
}

function LineNumber({ line, side }: { line: DiffLine; side: 'a' | 'b' }) {
  const index = side === 'a' ? line.a : line.b
  return (
    <span
      className={cn(
        'px-2 text-right tabular-nums select-none',
        NUMBER_TONE[line.kind],
      )}
    >
      {index >= 0 ? index + 1 : ''}
    </span>
  )
}

function Sign({ line }: { line: DiffLine }) {
  return (
    <span className={cn('text-center select-none', SIGN_TONE[line.kind])}>
      {SIGN[line.kind]}
    </span>
  )
}

function Code({
  line,
  index,
  text,
  syntax,
  wrap,
}: {
  line: DiffLine
  index: number
  text: string
  syntax: SideSyntax
  wrap: boolean
}) {
  const segments = syntax.segments(index, text, line.marks)
  return (
    <span
      className={cn(
        'min-w-0 pr-4',
        wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre',
      )}
    >
      {segments.map((segment, i) => (
        <span
          key={i}
          className={cn(segment.syntax, segment.marked && MARK_TONE[line.kind])}
        >
          {segment.parent ? (
            <span className="cm-tag-parent">{segment.text}</span>
          ) : (
            segment.text
          )}
        </span>
      ))}
      {/* An empty line still takes a line's height. */}
      {!text && ZERO_WIDTH}
    </span>
  )
}
