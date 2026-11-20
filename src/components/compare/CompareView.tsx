import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsExchange,
  IconChevronDown,
  IconChevronUp,
  IconLayoutColumns,
  IconLayoutRows,
  IconX,
} from '@tabler/icons-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useSelector } from '@tanstack/react-store'
import { useMemo, useRef, useState } from 'react'

import { DiffBody } from './DiffBody'
import { SideSyntax, syntaxRules } from './highlight'
import { ToolbarButton } from '#/components/app/ToolbarButton'
import {
  endCompare,
  setCompareIgnoreFormatting,
  setCompareIgnoreWhitespace,
  swapCompare,
  uiStore,
} from '#/components/app/ui-store'
import { getView } from '#/components/editor/editor-store'
import { editorPrefs, setDiffLayout } from '#/components/editor/word-wrap'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Separator } from '#/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useFileContent } from '#/hooks/use-files'
import { useHighlights } from '#/hooks/use-highlights'
import { useFormatSettings } from '#/hooks/use-profiles'
import { compareTexts } from '#/lib/compare'
import { diffLines, diffRows, diffStat, reveal } from '#/lib/diff'
import { languageOf } from '#/lib/document'
import { shortcuts } from '#/lib/shortcuts'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { DiffNavigation } from './DiffBody'
import type { DiffLayout } from '#/components/editor/word-wrap'
import type { CompareSide } from '#/lib/compare'
import type { FileDiff, Reveal, Revealed } from '#/lib/diff'

/** Ends the comparison and hands focus back to the editor. */
function closeCompare() {
  endCompare()
  requestAnimationFrame(() => getView()?.focus())
}

/**
 * The active file's changes against another open tab, shown in place of the
 * editor as git shows a diff. The other tab is the original, so what the
 * active file adds reads as added, until the sides are swapped.
 */
export function CompareView({
  fileId,
  otherId,
  wide,
}: {
  fileId: string
  otherId: string
  /** Room for the two sides next to each other. */
  wide: boolean
}) {
  const file = useFileContent(fileId)
  const other = useFileContent(otherId)
  const swapped = useSelector(uiStore, (s) => s.compareSwapped)

  useHotkey(
    'Escape',
    (e) => {
      // Dialogs, menus and the search panel close themselves first.
      if (e.defaultPrevented) return
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      closeCompare()
    },
    { ignoreInputs: false, preventDefault: false },
  )

  if (!file || !other) return null
  return (
    <CompareFiles
      original={swapped ? file : other}
      changed={swapped ? other : file}
      wide={wide}
    />
  )
}

/** The formatting options both sides share when formatting is ignored. */
function useCompareTexts(original: CompareSide, changed: CompareSide) {
  const ignoreFormatting = useSelector(
    uiStore,
    (s) => s.compareIgnoreFormatting,
  )
  const format = useFormatSettings()
  const highlights = useHighlights()
  const first = format.highlightedFirst
    ? highlights.filter((r) => r.enabled).map((r) => r.tag)
    : []
  const firstKey = first.join('\n')
  const orderKey = format.customOrder.join('\n')
  // Formatting large files is the costly part; only redo it when an input
  // changes. The pieces are listed one by one, as query rows are new objects.
  const { name: nameA, content: contentA } = original
  const { name: nameB, content: contentB } = changed
  return useMemo(
    () =>
      compareTexts(
        { name: nameA, content: contentA },
        { name: nameB, content: contentB },
        ignoreFormatting,
        {
          removeEmptyLines: format.removeEmptyLines,
          joinLines: format.joinLines,
          trimVars: format.trimVars,
          sort: format.sort,
          order: orderKey ? orderKey.split('\n') : [],
          first: firstKey ? firstKey.split('\n') : [],
        },
      ),
    [
      nameA,
      contentA,
      nameB,
      contentB,
      ignoreFormatting,
      format.removeEmptyLines,
      format.joinLines,
      format.trimVars,
      format.sort,
      orderKey,
      firstKey,
    ],
  )
}

const NOTHING_REVEALED: Revealed = new Map()

function CompareFiles({
  original,
  changed,
  wide,
}: {
  original: CompareSide
  changed: CompareSide
  wide: boolean
}) {
  const texts = useCompareTexts(original, changed)
  const ignoreFormatting = useSelector(
    uiStore,
    (s) => s.compareIgnoreFormatting,
  )
  const ignoreWhitespace = useSelector(
    uiStore,
    (s) => s.compareIgnoreWhitespace,
  )
  const preferred = useSelector(editorPrefs, (s) => s.diffLayout)
  const wrap = useSelector(editorPrefs, (s) => s.wordWrap)
  const layout: DiffLayout = wide ? preferred : 'unified'

  const fileDiff = useMemo(
    () => diffLines(texts.a, texts.b, ignoreWhitespace),
    [texts.a, texts.b, ignoreWhitespace],
  )
  // Opened folds belong to one diff; a new one starts folded.
  const [opened, setOpened] = useState<{
    diff: FileDiff
    revealed: Revealed
  }>({ diff: fileDiff, revealed: NOTHING_REVEALED })
  const revealed = opened.diff === fileDiff ? opened.revealed : NOTHING_REVEALED
  const rows = useMemo(
    () => diffRows(fileDiff, layout, revealed, ignoreWhitespace),
    [fileDiff, layout, revealed, ignoreWhitespace],
  )
  const onReveal = (gap: number, way: Reveal) =>
    setOpened({ diff: fileDiff, revealed: reveal(revealed, gap, way) })

  const languageA = languageOf(original.name, texts.a)
  const languageB = languageOf(changed.name, texts.b)
  const syntaxA = useMemo(
    () => new SideSyntax(fileDiff.a, languageA),
    [fileDiff.a, languageA],
  )
  const syntaxB = useMemo(
    () => new SideSyntax(fileDiff.b, languageB),
    [fileDiff.b, languageB],
  )

  const nav = useRef<DiffNavigation>(null)
  const changes = fileDiff.changes.length
  useHotkey(shortcuts.nextChange.hotkey, () => nav.current?.next(), {
    enabled: changes > 0,
  })
  useHotkey(shortcuts.previousChange.hotkey, () => nav.current?.previous(), {
    enabled: changes > 0,
  })

  return (
    <section
      aria-label={m.compare_label({ a: original.name, b: changed.name })}
      className="flex h-full min-h-0 flex-col"
    >
      {/* The editor's syntax colours, even with no editor on the page. */}
      <style>{syntaxRules}</style>
      <div className="flex h-11 shrink-0 items-center gap-1 border-b pr-1 pl-3 text-[11px] text-muted-foreground md:h-8">
        <Stats
          added={fileDiff.added}
          removed={fileDiff.removed}
          changes={changes}
        />
        {texts.unparsed !== null && (
          <span className="ml-2 flex min-w-0 items-center gap-1 text-foreground">
            <IconAlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">
              {m.compare_unparsed({ name: texts.unparsed })}
            </span>
          </span>
        )}
        <div className="flex-1" />
        <ToolbarButton
          label={m.compare_previous()}
          shortcut={shortcuts.previousChange}
          disabled={!changes}
          onClick={() => nav.current?.previous()}
        >
          <IconChevronUp />
        </ToolbarButton>
        <ToolbarButton
          label={m.compare_next()}
          shortcut={shortcuts.nextChange}
          disabled={!changes}
          onClick={() => nav.current?.next()}
        >
          <IconChevronDown />
        </ToolbarButton>
        <Separator
          orientation="vertical"
          className="mx-1 data-vertical:h-4 data-vertical:self-center"
        />
        {wide && <LayoutToggle layout={layout} />}
        <ToolbarButton
          label={m.compare_swap()}
          hint={m.compare_swap_hint()}
          onClick={swapCompare}
        >
          <IconArrowsExchange />
        </ToolbarButton>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ToolbarButton label={m.compare_options()}>
                  <IconAdjustmentsHorizontal />
                </ToolbarButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{m.compare_options()}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuCheckboxItem
              checked={ignoreWhitespace}
              onCheckedChange={setCompareIgnoreWhitespace}
            >
              {m.compare_ignore_whitespace()}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={ignoreFormatting}
              onCheckedChange={setCompareIgnoreFormatting}
            >
              {m.compare_ignore_formatting()}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator
          orientation="vertical"
          className="mx-1 data-vertical:h-4 data-vertical:self-center"
        />
        <ToolbarButton label={m.compare_close()} onClick={closeCompare}>
          <IconX />
        </ToolbarButton>
      </div>
      <div
        className={cn(
          'shrink-0 border-b font-mono text-[11px]',
          layout === 'split' ? 'grid grid-cols-2' : 'flex min-w-0 items-center',
        )}
      >
        <SideName name={original.name} side="removed" />
        {layout === 'unified' && (
          <IconArrowRight
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
        )}
        <SideName
          name={changed.name}
          side="added"
          className={layout === 'split' ? 'border-l' : undefined}
        />
      </div>
      {changes ? (
        <DiffBody
          diff={rows}
          a={fileDiff.a}
          b={fileDiff.b}
          syntaxA={syntaxA}
          syntaxB={syntaxB}
          layout={layout}
          wrap={wrap}
          label={m.compare_lines()}
          onReveal={onReveal}
          navRef={nav}
        />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>{m.compare_no_changes()}</EmptyTitle>
            <EmptyDescription>
              {ignoreFormatting || ignoreWhitespace
                ? m.compare_identical_ignoring()
                : m.compare_identical()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}

/** `+12 −4` and five squares, as GitHub sums up a file's changes. */
function Stats({
  added,
  removed,
  changes,
}: {
  added: number
  removed: number
  changes: number
}) {
  const squares = diffStat(added, removed)
  return (
    <span aria-live="polite" className="flex shrink-0 items-center gap-2">
      <span className="sr-only">
        {changes
          ? m.compare_stats({ added, removed, count: changes })
          : m.compare_no_changes()}
      </span>
      <span aria-hidden className="flex items-center gap-1.5 font-mono">
        <span className="font-medium text-(--hl-green)">+{added}</span>
        <span className="font-medium text-destructive">−{removed}</span>
        <span className="flex gap-px">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-2 rounded-[1px]',
                i < squares.added
                  ? 'bg-(--hl-green)'
                  : i < squares.added + squares.removed
                    ? 'bg-destructive'
                    : 'bg-muted-foreground/25',
              )}
            />
          ))}
        </span>
      </span>
      <span aria-hidden className="max-sm:hidden">
        {changes
          ? m.compare_changes({ count: changes })
          : m.compare_no_changes()}
      </span>
    </span>
  )
}

/** Side by side or in one column, kept for the next comparison. */
function LayoutToggle({ layout }: { layout: DiffLayout }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      value={layout}
      onValueChange={(value) => {
        if (value) setDiffLayout(value as DiffLayout)
      }}
      aria-label={m.compare_layout()}
      className="mr-1"
    >
      <ToggleGroupItem
        value="split"
        className="h-6 gap-1.5 px-2 text-[11px] font-normal"
      >
        <IconLayoutColumns className="size-3.5" />
        {m.compare_split()}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="unified"
        className="h-6 gap-1.5 px-2 text-[11px] font-normal"
      >
        <IconLayoutRows className="size-3.5" />
        {m.compare_unified()}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function SideName({
  name,
  side,
  className,
}: {
  name: string
  side: 'removed' | 'added'
  className?: string
}) {
  return (
    <div
      className={cn('flex h-7 min-w-0 items-center gap-2 px-3', className)}
      title={name}
    >
      <span
        aria-hidden
        className={cn(
          'h-3 w-0.5 shrink-0',
          side === 'removed' ? 'bg-destructive' : 'bg-(--hl-green)',
        )}
      />
      <span className="truncate">{name}</span>
    </div>
  )
}
