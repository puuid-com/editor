import { syntaxTree } from '@codemirror/language'
import { Compartment, Facet, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

import { copyText } from '#/components/app/clipboard'
import { decodeString } from '#/lib/json/parse'
import { m } from '#/paraglide/messages'
import type {
  ChangeSet,
  EditorState,
  Extension,
  Range,
  Text,
} from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'

// Values longer than the limit show only their two ends, with a chip in
// between that gives the size, expands the value and copies it. Display only:
// the document, search and save still see the full text.

/** Characters kept visible at each end of a shortened value. */
const LONG_VALUE_EDGE = 16

/** Shortest value that is shortened, or 0 to show every value in full. */
const limitFacet = Facet.define<number, number>({
  combine: (values) => values.at(-1) ?? 0,
})

const limitCompartment = new Compartment()

/** Effect that changes the length limit; 0 turns shortening off. */
export function setLongValueLimit(limit: number) {
  return limitCompartment.reconfigure(limitFacet.of(limit))
}

/** Expands (true) or shortens again (false) the value starting at `from`. */
const toggleValue = StateEffect.define<{ from: number; open: boolean }>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from) }),
})

interface LongValue {
  /** The value without surrounding whitespace, or the JSON string's quotes. */
  from: number
  to: number
  /** A JSON string, whose copy is decoded. */
  json: boolean
  /** How big the copied text is, as the chip shows it. */
  size: string
}

/**
 * The text a copy puts on the clipboard, read when it is asked for: values
 * can be megabytes, and are found again on every edit.
 */
export function valueText(state: EditorState, value: LongValue) {
  return value.json
    ? decodeString(state.sliceDoc(value.from - 1, value.to + 1))
    : state.sliceDoc(value.from, value.to)
}

/** `from`–`to` without the whitespace at either end, read in small windows. */
function trimmed(doc: Text, from: number, to: number) {
  const WINDOW = 64
  let start = from
  for (;;) {
    if (start >= to) return { from: to, to }
    const chunk = doc.sliceString(start, Math.min(to, start + WINDOW))
    const at = chunk.search(/\S/)
    if (at >= 0) {
      start += at
      break
    }
    start += chunk.length
  }
  // Something other than whitespace is at `start`, so this stops there.
  let end = to
  for (;;) {
    const chunk = doc.sliceString(Math.max(start, end - WINDOW), end)
    const trailing = chunk.length - chunk.trimEnd().length
    end -= trailing
    if (trailing < chunk.length) return { from: start, to: end }
  }
}

/** Values found before an edit, by where they start after it. */
type KnownValues = ReadonlyMap<number, LongValue>

/**
 * Values in the document longer than `limit` characters. `known` values
 * whose text is unchanged keep their size, so only edited ones are read.
 */
export function longValues(
  state: EditorState,
  limit: number,
  known: KnownValues = new Map(),
) {
  const values: Array<LongValue> = []
  if (limit <= 0) return values
  const value = (from: number, to: number, json: boolean): LongValue => {
    const old = known.get(from)
    if (old && old.to === to && old.json === json) return old
    const found = { from, to, json, size: '' }
    found.size = formatSize(utf8Length(valueText(state, found)))
    return found
  }
  syntaxTree(state).iterate({
    enter(node) {
      // Nothing inside a node this short can be longer than the limit.
      if (node.to - node.from <= limit) return false
      if (node.name === 'Text') {
        const { from, to } = trimmed(state.doc, node.from, node.to)
        if (to - from > limit) values.push(value(from, to, false))
        return false
      }
      if (node.name === 'String') {
        // JSON keys are PropertyName, so a String here is always a value.
        if (node.to - node.from - 2 > limit)
          values.push(value(node.from + 1, node.to - 1, true))
        return false
      }
      return undefined
    },
  })
  return values
}

/** Values an edit left untouched, moved to where they are after it. */
function unchangedValues(
  values: ReadonlyArray<LongValue>,
  changes: ChangeSet | null,
): KnownValues {
  const known = new Map<number, LongValue>()
  for (const value of values) {
    if (!changes) {
      known.set(value.from, value)
    } else if (!changes.touchesRange(value.from, value.to)) {
      const from = changes.mapPos(value.from)
      known.set(from, { ...value, from, to: changes.mapPos(value.to) })
    }
  }
  return known
}

/** Bytes `text` takes in UTF-8, without encoding it. */
function utf8Length(text: string) {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // Each half of a surrogate pair counts 2 of its 4 bytes.
    bytes +=
      code < 0x80 ? 1 : code < 0x800 || (code & 0xf800) === 0xd800 ? 2 : 3
  }
  return bytes
}

function formatSize(bytes: number) {
  if (bytes < 1024) return m.long_value_bytes({ count: bytes })
  const kb = bytes / 1024
  if (kb < 1024) return m.long_value_kb({ size: kb.toFixed(1) })
  return m.long_value_mb({ size: (kb / 1024).toFixed(1) })
}

const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/></svg>'

const COLLAPSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6"/></svg>'

function copyValue(view: EditorView, value: LongValue) {
  const text = valueText(view.state, value)
  void copyText(text, formatSize(utf8Length(text)))
}

function button(className: string, title: string, onClick: () => void) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.title = title
  el.setAttribute('aria-label', title)
  // Keep the editor from moving the cursor under the chip.
  el.addEventListener('mousedown', (event) => event.preventDefault())
  el.addEventListener('click', (event) => {
    event.preventDefault()
    onClick()
  })
  return el
}

/**
 * Whether two chips stand for the same value. The text is read when copied,
 * so a chip kept after an edit inside its value still copies the new text.
 */
function sameValue(a: LongValue, b: LongValue) {
  return (
    a.from === b.from && a.to === b.to && a.json === b.json && a.size === b.size
  )
}

/** The `… size [copy] …` chip that stands in for the middle of a value. */
class ShortenedWidget extends WidgetType {
  constructor(readonly value: LongValue) {
    super()
  }

  eq(other: ShortenedWidget) {
    return sameValue(other.value, this.value)
  }

  toDOM(view: EditorView) {
    const chip = document.createElement('span')
    chip.className = 'cm-long-value'
    const expand = button('cm-long-value-size', m.long_value_expand(), () =>
      view.dispatch({
        effects: toggleValue.of({ from: this.value.from, open: true }),
      }),
    )
    expand.textContent = `… ${this.value.size} …`
    const copy = button('cm-long-value-copy', m.long_value_copy(), () =>
      copyValue(view, this.value),
    )
    copy.innerHTML = COPY_ICON
    chip.appendChild(expand)
    chip.appendChild(copy)
    return chip
  }

  ignoreEvent() {
    return true
  }
}

/** Sits after an expanded value, to copy it or shorten it again. */
class ExpandedWidget extends WidgetType {
  constructor(readonly value: LongValue) {
    super()
  }

  eq(other: ExpandedWidget) {
    return sameValue(other.value, this.value)
  }

  toDOM(view: EditorView) {
    const chip = document.createElement('span')
    chip.className = 'cm-long-value'
    const collapse = button('cm-long-value-size', m.long_value_collapse(), () =>
      view.dispatch({
        effects: toggleValue.of({ from: this.value.from, open: false }),
      }),
    )
    collapse.innerHTML = COLLAPSE_ICON
    const copy = button('cm-long-value-copy', m.long_value_copy(), () =>
      copyValue(view, this.value),
    )
    copy.innerHTML = COPY_ICON
    chip.appendChild(collapse)
    chip.appendChild(copy)
    return chip
  }

  ignoreEvent() {
    return true
  }
}

interface LongValueState {
  /** Start of each value the user expanded, mapped through edits. */
  open: ReadonlySet<number>
  values: Array<LongValue>
  decorations: DecorationSet
}

function hidden(value: LongValue) {
  return {
    from: value.from + LONG_VALUE_EDGE,
    to: value.to - LONG_VALUE_EDGE,
  }
}

function decorate(
  values: ReadonlyArray<LongValue>,
  open: ReadonlySet<number>,
): DecorationSet {
  const ranges: Array<Range<Decoration>> = values.map((value) => {
    if (open.has(value.from)) {
      return Decoration.widget({
        widget: new ExpandedWidget(value),
        side: 1,
      }).range(value.to)
    }
    const { from, to } = hidden(value)
    return Decoration.replace({ widget: new ShortenedWidget(value) }).range(
      from,
      to,
    )
  })
  return Decoration.set(ranges, true)
}

/** Values the selection lands inside, e.g. after a search jump, open up. */
function openAtSelection(
  state: EditorState,
  values: ReadonlyArray<LongValue>,
  open: Set<number>,
) {
  let changed = false
  for (const range of state.selection.ranges) {
    for (const value of values) {
      if (open.has(value.from)) continue
      const { from, to } = hidden(value)
      // Inside one value, so select-all doesn't open every value.
      const inside = range.from >= value.from && range.to <= value.to
      if (inside && range.to > from && range.from < to) {
        open.add(value.from)
        changed = true
      }
    }
  }
  return changed
}

const longValueField = StateField.define<LongValueState>({
  create(state) {
    const open = new Set<number>()
    const values = longValues(state, state.facet(limitFacet))
    return { open, values, decorations: decorate(values, open) }
  },
  update(value, tr) {
    let open = value.open
    if (tr.docChanged && open.size > 0) {
      open = new Set([...open].map((pos) => tr.changes.mapPos(pos)))
    }
    for (const effect of tr.effects) {
      if (!effect.is(toggleValue)) continue
      const next = new Set(open)
      if (effect.value.open) next.add(effect.value.from)
      else next.delete(effect.value.from)
      open = next
    }
    // Values are found again only when the text or its parse changed; most
    // keep their size from before, so each edit reads just what it touched.
    const stale =
      tr.docChanged ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state) ||
      tr.startState.facet(limitFacet) !== tr.state.facet(limitFacet)
    const values = stale
      ? longValues(
          tr.state,
          tr.state.facet(limitFacet),
          unchangedValues(value.values, tr.docChanged ? tr.changes : null),
        )
      : value.values
    if (tr.selection) {
      const next = new Set(open)
      if (openAtSelection(tr.state, values, next)) open = next
    }
    if (!stale && open === value.open) return value
    return { open, values, decorations: decorate(values, open) }
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).decorations),
  ],
})

/** Shortens values longer than `limit` characters; 0 shows them in full. */
export function shortenLongValues(limit: number): Extension {
  return [limitCompartment.of(limitFacet.of(limit)), longValueField]
}
