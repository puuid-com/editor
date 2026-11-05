import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconExternalLink,
  IconGripVertical,
  IconPinnedOff,
  IconTag,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

import { copyText } from '#/components/app/clipboard'
import {
  editAtPath,
  editorStore,
  revealElement,
} from '#/components/editor/editor-store'
import { hlStyle } from '#/components/highlights/hl-style'
import {
  MatchNavItems,
  TagMenuHeader,
  ZplMenuItems,
} from '#/components/highlights/TagMenuItems'
import { LeafText } from '#/components/inspector/LeafText'
import { useDraft } from '#/components/inspector/use-draft'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { useEnabledDefaults } from '#/hooks/use-defaults'
import { useHighlightMap } from '#/hooks/use-highlights'
import { usePins } from '#/hooks/use-pins'
import { useFormatSettings } from '#/hooks/use-profiles'
import { setValue } from '#/lib/document'
import { localName, sameName } from '#/lib/names'
import { groupPins, pinRows } from '#/lib/pin-groups'
import { moveItem } from '#/lib/sort-order'
import { reorderPins, unpinTag } from '#/lib/store/pins'
import { cn } from '#/lib/utils'
import { isZplTag, openZplLabel } from '#/lib/zpl'
import { defaultIndex, isDefaultLeaf, leafDiffers } from '#/lib/xml/defaults'
import { allElements, displayPath, occurrenceLabels } from '#/lib/xml/locate'
import { hasName, isTextLeaf, leafValue } from '#/lib/xml/model'
import { m } from '#/paraglide/messages'
import type { XmlElement } from '#/lib/xml/model'

/**
 * Pinned tags at the top of the side panel, each editable in place, grouped
 * by highlight colour. Rows reorder within their group by dragging their
 * handle, or with the arrow keys on it.
 */
export function PinnedFields() {
  const pins = usePins()
  const doc = useSelector(editorStore, (s) => s.doc)
  const selectedPath = useSelector(editorStore, (s) => s.selectedPath)
  const highlights = useHighlightMap()
  const enabledDefaults = useEnabledDefaults()
  const defaults = useMemo(
    () => defaultIndex(enabledDefaults),
    [enabledDefaults],
  )
  const [unpinning, setUnpinning] = useState<string | null>(null)
  // Moving a row re-inserts its node, which drops focus; put it back after.
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const refocus = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Indexes into `rows`; `to` is an insertion point between rows.
  const [drag, setDrag] = useState<{ from: number; to: number | null } | null>(
    null,
  )

  useEffect(() => {
    const id = refocus.current
    refocus.current = null
    if (id) handles.current.get(id)?.focus()
  }, [pins])

  if (pins.length === 0) return null

  const groups = groupPins(pins, (pin) => highlights.get(localName(pin.tag)))
  const rows = pinRows(groups)

  // Saving the grouped order keeps each group's pins together.
  const move = (from: number, to: number) => {
    const { pin, first, last } = rows[from]
    const target = Math.max(first, Math.min(to, last))
    if (target === from) return
    reorderPins(
      moveItem(
        rows.map((r) => r.pin.id),
        from,
        target,
      ),
    )
    refocus.current = pin.id
    setAnnouncement(
      m.pin_moved({
        name: pin.tag,
        position: target - first + 1,
        count: last - first + 1,
      }),
    )
  }

  const onHandleKey = (e: React.KeyboardEvent, index: number) => {
    const { first, last } = rows[index]
    const to = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      Home: first,
      End: last,
    }[e.key]
    if (to === undefined) return
    e.preventDefault()
    move(index, to)
  }

  const drop = () => {
    if (drag?.to == null) return
    move(drag.from, drag.to > drag.from ? drag.to - 1 : drag.to)
  }

  const elements = allElements(doc.nodes)
  const leaves = elements.filter((el) => hasName(el) && isTextLeaf(el))
  // JSON array entries, whose index the labels put on their key.
  const items = new Set(
    elements.filter((el) => el.json?.item).map((el) => el.path),
  )
  const isItem = (path: string) => items.has(path)

  return (
    <section
      aria-label={m.pins_title()}
      className="flex max-h-[45%] shrink-0 flex-col border-b"
    >
      <div className="grid min-h-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 overflow-auto py-2 pr-3 pl-1">
        {rows.map(({ pin, group, first, last }, index) => {
          const els = leaves.filter((el) => sameName(el.name, pin.tag))
          const labels = occurrenceLabels(
            els.map((el) => el.path),
            isItem,
          )
          const matches = els.map((el, i) => ({
            el,
            label: labels[i],
            defaultKey: isDefaultLeaf(defaults, el) ? el.name : undefined,
            differs: leafDiffers(defaults, el),
          }))
          return (
            <Fragment key={pin.id}>
              {index === first && group > 0 && (
                <div
                  aria-hidden
                  className="col-span-2 col-start-2 my-1 h-px bg-border"
                />
              )}
              <div
                onDragOver={(e) => {
                  if (!drag || rows[drag.from].group !== group) return
                  e.preventDefault()
                  const box = e.currentTarget.getBoundingClientRect()
                  const after = e.clientY > box.top + box.height / 2
                  const to = index + Number(after)
                  if (to !== drag.to) setDrag({ ...drag, to })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop()
                  setDrag(null)
                }}
                className={cn(
                  'col-span-3 grid grid-cols-subgrid items-center gap-y-1',
                  drag?.from === index && 'opacity-50',
                  drag?.to === index && 'shadow-[0_-2px_0_var(--ring)]',
                  drag?.to === index + 1 &&
                    index === last &&
                    'shadow-[0_2px_0_var(--ring)]',
                )}
              >
                <button
                  type="button"
                  draggable
                  ref={(node) => {
                    if (node) handles.current.set(pin.id, node)
                    else handles.current.delete(pin.id)
                  }}
                  aria-label={m.pin_move({ name: pin.tag })}
                  onKeyDown={(e) => onHandleKey(e, index)}
                  onDragStart={(e) => {
                    setDrag({ from: index, to: null })
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', pin.tag)
                    // Drag the whole row, not just the handle.
                    const row = e.currentTarget.parentElement
                    if (row) e.dataTransfer.setDragImage(row, 8, 8)
                  }}
                  onDragEnd={() => setDrag(null)}
                  className="grid min-h-11 w-5 cursor-grab place-items-center text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing md:min-h-6"
                >
                  <IconGripVertical aria-hidden className="size-3.5" />
                </button>
                <PinnedField
                  tag={pin.tag}
                  matches={matches}
                  current={matches.findIndex(
                    (match) => match.el.path === selectedPath,
                  )}
                  color={highlights.get(localName(pin.tag))}
                  onMoveUp={
                    index > first ? () => move(index, index - 1) : undefined
                  }
                  onMoveDown={
                    index < last ? () => move(index, index + 1) : undefined
                  }
                  onUnpin={() => setUnpinning(pin.tag)}
                />
              </div>
            </Fragment>
          )
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <AlertDialog
        open={!!unpinning}
        onOpenChange={(open) => {
          if (!open) setUnpinning(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.pin_remove({ name: unpinning ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.pin_remove_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (unpinning) unpinTag(unpinning)
              }}
            >
              {m.pin_remove_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

type PinMatch = {
  el: XmlElement
  /** Where it sits, such as `Line[2]`, telling it apart from the others. */
  label: string
  /** Set when the value equals the default for this key. */
  defaultKey: string | undefined
  /** Whether the value differs from the default for this key. */
  differs: boolean
}

/**
 * A pinned tag and its value. When the tag appears more than once, each
 * occurrence gets its own field, hanging under the tag on a guide line and
 * labelled with its parent; clicking the label moves the cursor there.
 */
function PinnedField({
  tag,
  matches,
  current,
  color,
  onMoveUp,
  onMoveDown,
  onUnpin,
}: {
  tag: string
  /** Every element named `tag`, in document order. */
  matches: ReadonlyArray<PinMatch>
  /** Index into `matches` of the one under the cursor, or -1. */
  current: number
  color: string | undefined
  /** Unset when the row can't move that way. */
  onMoveUp: (() => void) | undefined
  onMoveDown: (() => void) | undefined
  onUnpin: () => void
}) {
  const many = matches.length > 1
  const menuEl = (matches.at(current) ?? matches.at(0))?.el

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            aria-label={m.pin_copy_name({ name: tag })}
            className={cn(
              'group/tag flex min-h-11 max-w-44 min-w-0 cursor-pointer items-center gap-1 px-1 text-left font-mono text-xs font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:min-h-0',
              color ? 'hl-tag hl-ink' : 'text-syntax-tag',
            )}
            style={hlStyle(color)}
            onClick={() => void copyText(tag, tag)}
          >
            <IconTag
              aria-hidden
              className="size-3 shrink-0 opacity-60 group-hover/tag:opacity-100 group-focus-visible/tag:opacity-100"
            />
            <span className="truncate">{tag}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <TagMenuHeader tag={tag} />
          <MatchNavItems tag={tag} count={matches.length} />
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!onMoveUp} onSelect={onMoveUp}>
            <IconArrowUp />
            {m.pin_move_up()}
          </ContextMenuItem>
          <ContextMenuItem disabled={!onMoveDown} onSelect={onMoveDown}>
            <IconArrowDown />
            {m.pin_move_down()}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ZplMenuItems
            tag={tag}
            value={menuEl ? leafValue(menuEl) : undefined}
          />
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={onUnpin}>
            <IconPinnedOff />
            {m.pin_remove({ name: tag })}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {many ? (
        <span className="px-1.5 text-xs text-muted-foreground">
          {m.pin_matches_count({ count: matches.length })}
        </span>
      ) : (
        <PinValue tag={tag} label={tag} match={matches.at(0)} />
      )}
      {many &&
        matches.map((match, index) => (
          <Fragment key={match.el.path}>
            <button
              type="button"
              title={displayPath(match.el.path).join(' › ')}
              aria-current={index === current ? 'location' : undefined}
              onClick={() => revealElement(match.el)}
              className={cn(
                'relative col-start-2 flex min-h-11 max-w-44 min-w-0 items-center self-stretch pr-1 pl-5 text-left font-mono text-[11px] text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:min-h-6',
                // The guide line down from the tag, with a tick to each label.
                'before:absolute before:-top-1 before:left-2.5 before:w-px before:bg-muted-foreground/40',
                'after:absolute after:top-1/2 after:left-2.5 after:h-px after:w-1.5 after:bg-muted-foreground/40',
                index === matches.length - 1
                  ? 'before:bottom-1/2'
                  : 'before:bottom-0',
                index === current && 'font-semibold text-foreground',
              )}
            >
              <span className="truncate">{match.label}</span>
            </button>
            <PinValue
              tag={tag}
              label={m.pin_occurrence({
                name: tag,
                index: index + 1,
                count: matches.length,
                parent: match.label,
              })}
              match={match}
            />
          </Fragment>
        ))}
    </>
  )
}

/** One occurrence's value, editable in place. */
function PinValue({
  tag,
  label,
  match,
}: {
  tag: string
  label: string
  /** Unset when the tag isn't in the file. */
  match: PinMatch | undefined
}) {
  const el = match?.el
  const value = el ? leafValue(el) : ''
  const path = el?.path
  const draft = useDraft(value, (next) => {
    if (path) editAtPath(path, (fresh) => setValue(fresh, next))
  })
  const placeholder = el ? m.node_empty() : m.pin_missing()
  const zpl = isZplTag(useFormatSettings().zplTags, tag)
  // Show the value like the tree does until the field is being edited.
  const [editing, setEditing] = useState(false)
  const rendered = !!el && !editing && draft.value.trim() !== ''

  return (
    <InputGroup className="h-11 bg-background font-mono md:h-6">
      <div className="relative flex h-full min-w-0 flex-1">
        <InputGroupInput
          aria-label={label}
          disabled={!el}
          placeholder={placeholder}
          className={cn(
            'h-11 px-1.5 text-base md:h-6 md:text-xs',
            rendered && 'text-transparent',
          )}
          {...draft}
          onFocus={() => {
            draft.onFocus()
            setEditing(true)
          }}
          onBlur={() => {
            draft.onBlur()
            setEditing(false)
          }}
        />
        {rendered && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex min-w-0 items-center overflow-hidden px-1.5 text-base md:text-xs"
          >
            <LeafText
              value={draft.value}
              defaultKey={match.defaultKey}
              differs={match.differs}
            />
          </span>
        )}
      </div>
      <InputGroupAddon align="inline-end" className="py-0">
        <InputGroupButton
          size="icon-xs"
          aria-label={m.pin_copy({ name: tag })}
          disabled={!el}
          className="text-muted-foreground max-md:size-11"
          onClick={() => void copyText(draft.value, draft.value)}
        >
          <IconCopy className="size-3" />
        </InputGroupButton>
        {zpl && (
          <InputGroupButton
            size="icon-xs"
            aria-label={m.zpl_open_name({ name: tag })}
            disabled={!el || !draft.value.trim()}
            className="text-muted-foreground max-md:size-11"
            onClick={() => openZplLabel(draft.value)}
          >
            <IconExternalLink className="size-3" />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
