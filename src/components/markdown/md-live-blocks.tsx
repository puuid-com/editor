import { redo, undo } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import {
  Annotation,
  ChangeSet,
  EditorState,
  MapMode,
  Prec,
  RangeSet,
  RangeValue,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  runScopeHandlers,
} from '@codemirror/view'
import { createRoot } from 'react-dom/client'
import type { ChangeSpec, Extension, Range } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { Root } from 'react-dom/client'

import { isLive, setMarkdownLive } from './md-live'
import { TableToolbar } from './TableControls'
import type { TableToolbarInfo } from './TableControls'
import {
  addColumn,
  addRow,
  alignColumn,
  columnAt,
  columnCount,
  formatTable,
  parseTable,
  removeColumn,
  removeRow,
  rowOfLine,
} from '#/lib/markdown-table'
import type {
  MarkdownTable,
  TableAlign,
  TableCell,
  TableEdit,
} from '#/lib/markdown-table'
import { m } from '#/paraglide/messages'

// Live preview's blocks. A fenced code block shows its code alone, between a
// header naming its language and a closing rule, and a table shows as a grid
// whose cells are typed in directly. Their Markdown (fences, pipes, the rule
// under the header) never shows: the caret steps over it, and edits that
// would break it are turned away.

/** A hidden line or table: what it is, where, and the text at its ends. */
interface LiveBlock {
  kind: 'open' | 'close' | 'table'
  from: number
  to: number
  first: string
  last: string
}

interface LiveBlocks {
  blocks: Array<LiveBlock>
  decorations: DecorationSet
  /** Each block with the line breaks around it, which the caret skips. */
  atomic: RangeSet<RangeValue>
}

const NONE: LiveBlocks = {
  blocks: [],
  decorations: Decoration.none,
  atomic: RangeSet.empty,
}

/** Marks a change made from a block's own controls, which can rewrite it. */
const ownEdit = Annotation.define<boolean>()

class Skip extends RangeValue {}
const skip = new Skip()

/* ---------------- Finding blocks ---------------- */

function findBlocks(state: EditorState): LiveBlocks {
  if (!isLive(state)) return NONE
  const { doc } = state
  const blocks: Array<LiveBlock> = []
  const decorations: Array<Range<Decoration>> = []
  const atomic: Array<Range<RangeValue>> = []
  const add = (block: LiveBlock, widget: WidgetType) => {
    blocks.push(block)
    decorations.push(
      Decoration.replace({ widget, block: true }).range(block.from, block.to),
    )
    atomic.push(
      skip.range(
        Math.max(0, block.from - 1),
        Math.min(doc.length, block.to + 1),
      ),
    )
  }
  // Only blocks at the top level: in a list or quote their lines carry
  // markers that a widget would hide.
  for (
    let node = syntaxTree(state).topNode.firstChild;
    node;
    node = node.nextSibling
  ) {
    const start = doc.lineAt(node.from)
    if (start.from !== node.from) continue
    if (node.name === 'FencedCode') {
      const marks = node.getChildren('CodeMark')
      if (marks.length < 2) continue
      const end = doc.lineAt(marks[marks.length - 1].from)
      // Unclosed, or with no line to put the caret on.
      if (end.number <= start.number + 1) continue
      const info = node.getChild('CodeInfo')
      add(
        {
          kind: 'open',
          from: start.from,
          to: start.to,
          first: start.text,
          last: start.text,
        },
        new FenceHeader(info ? doc.sliceString(info.from, info.to) : ''),
      )
      add(
        {
          kind: 'close',
          from: end.from,
          to: end.to,
          first: end.text,
          last: end.text,
        },
        new FenceFooter(),
      )
    } else if (node.name === 'Table') {
      const end = doc.lineAt(node.to)
      const lines: Array<string> = []
      for (let n = start.number; n <= end.number; n++)
        lines.push(doc.line(n).text)
      if (lines.length < 2) continue
      add(
        {
          kind: 'table',
          from: start.from,
          to: end.to,
          first: start.text,
          last: end.text,
        },
        new TableWidget(parseTable(lines)),
      )
    }
  }
  return {
    blocks,
    decorations: Decoration.set(decorations),
    atomic: RangeSet.of(atomic, true),
  }
}

const liveBlocks = StateField.define<LiveBlocks>({
  create: findBlocks,
  update(value, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((effect) => effect.is(setMarkdownLive)) ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state)
    )
      return findBlocks(tr.state)
    return value
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of(
      (view) => view.state.field(field, false)?.atomic ?? RangeSet.empty,
    ),
  ],
})

const blocksOf = (state: EditorState) =>
  state.field(liveBlocks, false)?.blocks ?? []

/** Whether live preview shows the table starting at `from` as a grid. */
export const isGridTable = (state: EditorState, from: number) =>
  blocksOf(state).some((block) => block.kind === 'table' && block.from === from)

/* ---------------- Keeping blocks whole ---------------- */

/**
 * Typing next to a hidden line goes on a line of its own, and an edit that
 * would break a block's Markdown, like joining a fence to the next line, is
 * dropped. Whole blocks can still be deleted with a selection.
 */
const keepBlocks = EditorState.transactionFilter.of((tr) => {
  if (
    !tr.docChanged ||
    tr.annotation(ownEdit) ||
    !(tr.isUserEvent('input') || tr.isUserEvent('delete'))
  )
    return tr
  const blocks = blocksOf(tr.startState)
  if (!blocks.length) return tr
  const keyDelete =
    tr.isUserEvent('delete') &&
    !tr.isUserEvent('delete.cut') &&
    tr.startState.selection.ranges.every((range) => range.empty)
  const { doc } = tr.startState
  const specs: Array<ChangeSpec & { moved: boolean }> = []
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    let insert = inserted.toString()
    const typed = insert
    if (fromA === toA && insert)
      for (const block of blocks) {
        if (fromA === block.to && !insert.startsWith('\n'))
          insert = `\n${insert}`
        else if (fromA === block.from && !insert.endsWith('\n'))
          insert = `${insert}\n`
        else if (
          block.kind === 'table' &&
          fromA === block.to + 1 &&
          !doc.lineAt(fromA).length &&
          !/^[\n|]/.test(insert)
        )
          // Text right under a table would be read as one more row.
          insert = `\n${insert}`
      }
    specs.push({ from: fromA, to: toA, insert, moved: insert !== typed })
  })
  const moved = specs.some((spec) => spec.moved)
  const changes = moved
    ? ChangeSet.of(specs, tr.startState.doc.length)
    : tr.changes
  const next = changes.apply(doc)
  for (const block of blocks) {
    const from = changes.mapPos(block.from, 1, MapMode.TrackDel)
    const to = changes.mapPos(block.to, -1, MapMode.TrackDel)
    // A key that deletes a character never takes a whole block with it.
    if (from === null || to === null) {
      if (keyDelete) return {}
      continue
    }
    const first = next.lineAt(from)
    const last = next.lineAt(to)
    if (
      first.from !== from ||
      first.text !== block.first ||
      last.to !== to ||
      last.text !== block.last
    )
      return {}
  }
  if (!moved) return tr
  return {
    changes,
    selection: tr.startState.selection.map(changes, 1),
    scrollIntoView: true,
    userEvent: tr.annotation(Transaction.userEvent),
  }
})

/* ---------------- Moving around ---------------- */

/** The grid of the table starting at `from`, if it is on screen. */
function gridAt(view: EditorView, from: number) {
  for (const dom of view.contentDOM.querySelectorAll<HTMLElement>(
    '.cm-md-table',
  ))
    if (view.posAtDOM(dom) === from) return grids.get(dom)
  return undefined
}

/** Up and down step over hidden lines, and into a table's grid. */
function moveLine(forward: boolean) {
  return (view: EditorView) => {
    const { state } = view
    const { main } = state.selection
    if (state.selection.ranges.length > 1 || !main.empty) return false
    const target = view.moveVertically(main, forward).head
    const here = state.doc.lineAt(main.head)
    // The nearest block the move lands in or passes over.
    const blocks = blocksOf(state).filter((b) =>
      forward
        ? b.from > here.to && b.from <= target
        : b.to < here.from && b.to >= target,
    )
    const block = forward ? blocks[0] : blocks.at(-1)
    if (!block) return false
    if (block.kind === 'table') {
      const grid = gridAt(view, block.from)
      if (!grid) return false
      grid.focusCell({ row: forward ? 0 : grid.table.rows.length - 1, col: 0 })
      return true
    }
    const { length } = state.doc
    const anchor = forward
      ? Math.min(length, block.to + 1)
      : Math.max(0, block.from - 1)
    view.dispatch({ selection: { anchor }, scrollIntoView: true })
    return true
  }
}

/**
 * Backspace just after a block, or Delete just before one, removes the line
 * break alone instead of the block the caret would skip over. If that would
 * join text to the block, nothing happens.
 */
function deleteBreak(forward: boolean) {
  return (view: EditorView) => {
    const { state } = view
    const { main } = state.selection
    if (state.selection.ranges.length > 1 || !main.empty) return false
    const at = main.head
    const next = blocksOf(state).some((block) =>
      forward ? block.from === at + 1 : block.to === at - 1,
    )
    if (!next) return false
    view.dispatch({
      changes: forward ? { from: at, to: at + 1 } : { from: at - 1, to: at },
      userEvent: forward ? 'delete.forward' : 'delete.backward',
    })
    return true
  }
}

const moveKeys = Prec.high(
  keymap.of([
    { key: 'ArrowDown', run: moveLine(true) },
    { key: 'ArrowUp', run: moveLine(false) },
    { key: 'Backspace', run: deleteBreak(false) },
    { key: 'Delete', run: deleteBreak(true) },
  ]),
)

/** A caret put inside a table, as after `/table`, moves into its grid. */
const caretToGrid = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.selectionSet && !update.docChanged) return
      const { state, view } = update
      const head = state.selection.main.head
      const block = blocksOf(state).find(
        (b) => b.kind === 'table' && head > b.from && head < b.to,
      )
      if (!block) return
      const first = state.doc.lineAt(block.from)
      const line = state.doc.lineAt(head)
      const cell = {
        row: rowOfLine(line.number - first.number),
        col: columnAt(line.text, head - line.from),
      }
      queueMicrotask(() => gridAt(view, block.from)?.focusCell(cell))
    }
  },
)

/* ---------------- Code blocks ---------------- */

const FENCE = /^(\s*(?:`{3,}|~{3,}))(.*)$/

/** The opening fence: the block's language, edited in place. */
class FenceHeader extends WidgetType {
  constructor(readonly info: string) {
    super()
  }
  eq(other: FenceHeader) {
    return other.info === this.info
  }
  toDOM(view: EditorView) {
    const dom = document.createElement('div')
    dom.className = 'cm-md-fence-open'
    const input = document.createElement('input')
    input.className = 'cm-md-fence-lang'
    input.value = this.info
    input.placeholder = m.md_code_language()
    input.setAttribute('aria-label', m.md_code_language())
    input.spellcheck = false
    input.addEventListener('input', () => {
      const line = view.state.doc.lineAt(view.posAtDOM(dom))
      const fence = FENCE.exec(line.text)
      if (!fence) return
      view.dispatch({
        changes: {
          from: line.from + fence[1].length,
          to: line.to,
          insert: input.value.replace(/[`\n]/g, ''),
        },
        annotations: ownEdit.of(true),
        userEvent: 'input',
      })
    })
    input.addEventListener('keydown', (event) => {
      if (!['Enter', 'ArrowDown', 'Escape', 'ArrowUp'].includes(event.key))
        return
      event.preventDefault()
      const line = view.state.doc.lineAt(view.posAtDOM(dom))
      const anchor =
        event.key === 'ArrowUp'
          ? Math.max(0, line.from - 1)
          : Math.min(view.state.doc.length, line.to + 1)
      view.focus()
      view.dispatch({ selection: { anchor }, scrollIntoView: true })
    })
    dom.appendChild(input)
    return dom
  }
  updateDOM(dom: HTMLElement) {
    const input = dom.querySelector('input')
    if (input && input !== document.activeElement) input.value = this.info
    return true
  }
  ignoreEvent() {
    return true
  }
}

class FenceFooter extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const dom = document.createElement('div')
    dom.className = 'cm-md-fence-close'
    return dom
  }
  ignoreEvent() {
    return true
  }
}

/* ---------------- Tables ---------------- */

const grids = new WeakMap<HTMLElement, TableGrid>()

/** A cell's text as typed, its escaped pipes as plain ones. */
const shownText = (cell: string) => cell.replace(/\\\|/g, '|')
const writtenText = (text: string) =>
  text.replace(/\n/g, ' ').replace(/\\?\|/g, '\\|')

const sameTable = (a: MarkdownTable, b: MarkdownTable) =>
  JSON.stringify(a) === JSON.stringify(b)

class TableWidget extends WidgetType {
  constructor(readonly table: MarkdownTable) {
    super()
  }
  eq(other: TableWidget) {
    return sameTable(other.table, this.table)
  }
  toDOM(view: EditorView) {
    const dom = document.createElement('div')
    grids.set(dom, new TableGrid(view, dom, this.table))
    return dom
  }
  updateDOM(dom: HTMLElement) {
    const grid = grids.get(dom)
    if (!grid) return false
    grid.update(this.table)
    return true
  }
  destroy(dom: HTMLElement) {
    grids.get(dom)?.destroy()
  }
  ignoreEvent() {
    return true
  }
}

/** Keys the cell keeps for itself rather than the editor's shortcuts. */
const CELL_KEYS = new Set(['a', 'c', 'v', 'x', 'z', 'y'])

/** Where the caret is in `el`'s text, or null with a selection. */
function caretOffset(el: HTMLElement) {
  const selection = el.ownerDocument.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const before = range.cloneRange()
  before.selectNodeContents(el)
  before.setEnd(range.endContainer, range.endOffset)
  return before.toString().length
}

/** A table as a grid of cells typed in directly, with its toolbar on top. */
class TableGrid {
  cell: TableCell | null = null
  menuOpen = false
  private readonly bar: HTMLElement
  private readonly grid: HTMLTableElement
  private readonly root: Root

  constructor(
    readonly view: EditorView,
    readonly dom: HTMLElement,
    public table: MarkdownTable,
  ) {
    dom.className = 'cm-md-table'
    dom.contentEditable = 'false'
    this.bar = document.createElement('div')
    this.bar.className = 'cm-md-table-bar'
    this.bar.hidden = true
    this.root = createRoot(this.bar)
    const scroll = document.createElement('div')
    scroll.className = 'cm-md-table-scroll'
    this.grid = document.createElement('table')
    scroll.appendChild(this.grid)
    dom.appendChild(this.bar)
    dom.appendChild(scroll)
    this.grid.addEventListener('input', (event) => this.onInput(event))
    this.grid.addEventListener('keydown', (event) => this.onKey(event))
    dom.addEventListener('focusin', (event) => this.onFocus(event))
    dom.addEventListener('focusout', () => queueMicrotask(() => this.onBlur()))
    this.render()
  }

  private cellEl({ row, col }: TableCell) {
    return this.grid.querySelector<HTMLElement>(
      `[data-row="${row}"][data-col="${col}"]`,
    )
  }

  private cellOf(el: EventTarget | null): TableCell | null {
    if (!(el instanceof HTMLElement) || !el.dataset.row) return null
    return { row: Number(el.dataset.row), col: Number(el.dataset.col) }
  }

  private render() {
    const { rows, aligns } = this.table
    const cols = columnCount(this.table)
    const row = (cells: Array<string>, index: number) => {
      const tr = document.createElement('tr')
      for (let col = 0; col < cols; col++) {
        const td = document.createElement(index === 0 ? 'th' : 'td')
        td.contentEditable = 'plaintext-only'
        td.spellcheck = false
        td.dataset.row = String(index)
        td.dataset.col = String(col)
        td.textContent = shownText(cells[col] ?? '')
        td.style.textAlign = aligns[col] ?? 'start'
        tr.appendChild(td)
      }
      return tr
    }
    const head = document.createElement('thead')
    head.appendChild(row(rows[0], 0))
    const body = document.createElement('tbody')
    rows.slice(1).forEach((cells, i) => body.appendChild(row(cells, i + 1)))
    this.grid.replaceChildren(head, body)
  }

  /** Shows the table's latest text, leaving the cell being typed in alone. */
  update(table: MarkdownTable) {
    const shape = (t: MarkdownTable) => `${t.rows.length}x${columnCount(t)}`
    const reshaped = shape(table) !== shape(this.table)
    this.table = table
    if (reshaped) {
      const focused = this.cell
      this.render()
      if (focused) this.focusCell(focused)
    } else
      for (const el of this.grid.querySelectorAll<HTMLElement>('[data-row]')) {
        const cell = this.cellOf(el)!
        const text = shownText(table.rows[cell.row]?.[cell.col] ?? '')
        el.style.textAlign = table.aligns[cell.col] ?? 'start'
        if (el.textContent.trim() === text) continue
        el.textContent = text
        if (el === document.activeElement) this.focusCell(cell)
      }
    this.renderBar()
  }

  /** Puts the caret at the end of `cell`, clamped to the table. */
  focusCell({ row, col }: TableCell) {
    const cell = {
      row: Math.max(0, Math.min(row, this.table.rows.length - 1)),
      col: Math.max(0, Math.min(col, columnCount(this.table) - 1)),
    }
    const el = this.cellEl(cell)
    if (!el) return
    el.focus()
    const selection = el.ownerDocument.getSelection()
    if (selection) {
      const range = el.ownerDocument.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    this.cell = cell
    this.renderBar()
  }

  private block() {
    const from = this.view.posAtDOM(this.dom)
    return blocksOf(this.view.state).find(
      (b) => b.kind === 'table' && b.from === from,
    )
  }

  /** The table as the document has it now. */
  private current() {
    const block = this.block()
    if (!block) return null
    return {
      block,
      table: parseTable(
        this.view.state.sliceDoc(block.from, block.to).split('\n'),
      ),
    }
  }

  private write(table: MarkdownTable, focus?: TableCell) {
    const block = this.block()
    if (!block) return
    if (focus) this.cell = focus
    this.view.dispatch({
      changes: {
        from: block.from,
        to: block.to,
        insert: formatTable(table).join('\n'),
      },
      annotations: ownEdit.of(true),
      userEvent: 'input',
    })
    if (focus) this.focusCell(focus)
  }

  private edit(
    change: (table: MarkdownTable, cell: TableCell) => TableEdit,
    at = this.cell,
  ) {
    const now = this.current()
    if (!now || !at) return
    const { table, cell } = change(now.table, at)
    this.write(table, cell)
  }

  private onInput(event: Event) {
    const el = event.target as HTMLElement
    const cell = this.cellOf(el)
    const now = this.current()
    if (!cell || !now) return
    let text = el.textContent
    if (text.includes('\n')) {
      text = text.replace(/\n/g, ' ')
      el.textContent = text
      this.focusCell(cell)
    }
    const rows = now.table.rows.map((cells) => [...cells])
    while (rows[cell.row].length <= cell.col) rows[cell.row].push('')
    rows[cell.row][cell.col] = writtenText(text)
    this.write({ ...now.table, rows })
  }

  /** Moves the editor's caret out of the table, above or below it. */
  private leave(down: boolean) {
    const block = this.block()
    if (!block) return
    const { length } = this.view.state.doc
    const anchor = down
      ? Math.min(length, block.to + 1)
      : Math.max(0, block.from - 1)
    this.view.focus()
    this.view.dispatch({ selection: { anchor }, scrollIntoView: true })
  }

  private onKey(event: KeyboardEvent) {
    const el = event.target as HTMLElement
    const cell = this.cellOf(el)
    if (!cell) return
    const { row, col } = cell
    const rows = this.table.rows.length
    const cols = columnCount(this.table)
    const mod = event.metaKey || event.ctrlKey
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
      handled()
      if (event.shiftKey) redo(this.view)
      else undo(this.view)
      return
    }
    if (mod && !event.altKey && event.key.toLowerCase() === 'y') {
      handled()
      redo(this.view)
      return
    }
    if ((mod || event.altKey) && !CELL_KEYS.has(event.key.toLowerCase())) {
      if (runScopeHandlers(this.view, event, 'editor')) handled()
      return
    }
    const offset = caretOffset(el)
    const length = el.textContent.length
    switch (event.key) {
      case 'Tab': {
        handled()
        const index = row * cols + col + (event.shiftKey ? -1 : 1)
        if (index < 0) return
        if (index >= rows * cols) this.edit(addRow, { row: rows - 1, col: 0 })
        else
          this.focusCell({ row: Math.floor(index / cols), col: index % cols })
        return
      }
      case 'Enter':
        handled()
        if (event.shiftKey) return
        if (row < rows - 1) this.focusCell({ row: row + 1, col })
        else
          this.edit(
            (table, at) => ({
              ...addRow(table, at),
              cell: { row: at.row + 1, col: at.col },
            }),
            cell,
          )
        return
      case 'ArrowUp':
        handled()
        if (row === 0) this.leave(false)
        else this.focusCell({ row: row - 1, col })
        return
      case 'ArrowDown':
        handled()
        if (row === rows - 1) this.leave(true)
        else this.focusCell({ row: row + 1, col })
        return
      case 'ArrowLeft':
        if (offset !== 0 || event.shiftKey || (row === 0 && col === 0)) return
        handled()
        this.focusCell(
          col > 0 ? { row, col: col - 1 } : { row: row - 1, col: cols - 1 },
        )
        return
      case 'ArrowRight':
        if (offset !== length || event.shiftKey) return
        if (row === rows - 1 && col === cols - 1) return
        handled()
        this.focusCell(
          col < cols - 1 ? { row, col: col + 1 } : { row: row + 1, col: 0 },
        )
        return
      case 'Escape':
        handled()
        this.leave(true)
        return
      default:
    }
  }

  private onFocus(event: FocusEvent) {
    const cell = this.cellOf(event.target)
    if (!cell) return
    this.cell = cell
    this.bar.hidden = false
    this.renderBar()
  }

  private onBlur() {
    if (this.menuOpen || this.dom.contains(document.activeElement)) return
    this.cell = null
    this.bar.hidden = true
  }

  private renderBar() {
    if (!this.cell || this.bar.hidden) return
    const info: TableToolbarInfo = {
      align: this.table.aligns[this.cell.col] ?? null,
      isHeader: this.cell.row === 0,
      isOnlyColumn: columnCount(this.table) < 2,
    }
    const refocus = () => {
      if (this.cell) this.focusCell(this.cell)
    }
    this.root.render(
      <TableToolbar
        info={info}
        actions={{
          addRow: () => this.edit(addRow),
          addColumn: () => this.edit(addColumn),
          align: (align: TableAlign) =>
            this.edit((table, cell) => alignColumn(table, cell, align)),
          deleteRow: () => this.edit(removeRow),
          deleteColumn: () => this.edit(removeColumn),
          deleteTable: () => this.deleteTable(),
          onMenuOpenChange: (open) => {
            this.menuOpen = open
          },
          onMenuClosed: refocus,
        }}
      />,
    )
  }

  private deleteTable() {
    const block = this.block()
    if (!block) return
    const { doc } = this.view.state
    const next = block.to < doc.length ? doc.lineAt(block.to + 1) : null
    this.menuOpen = false
    this.view.focus()
    this.view.dispatch({
      changes: {
        from: block.from,
        to: next && !next.text.trim() ? next.to : block.to,
      },
      selection: { anchor: block.from },
      annotations: ownEdit.of(true),
      userEvent: 'delete',
    })
  }

  destroy() {
    const { root } = this
    // Later, as CodeMirror can get here while React is committing.
    queueMicrotask(() => root.unmount())
  }
}

/* ---------------- The extension ---------------- */

const MUTED = 'color-mix(in oklch, var(--foreground) 4%, transparent)'

export function markdownLiveBlocks(): Extension {
  return [
    liveBlocks,
    keepBlocks,
    moveKeys,
    caretToGrid,
    EditorView.baseTheme({
      '.cm-md-fence-open': {
        backgroundColor: MUTED,
        boxShadow: 'inset 0 1px 0 var(--border)',
        padding: '2px 16px 0 8px',
      },
      '.cm-md-fence-lang': {
        width: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--muted-foreground)',
        font: 'inherit',
        fontSize: '0.85em',
      },
      '.cm-md-fence-close': {
        height: '6px',
        backgroundColor: MUTED,
        boxShadow: 'inset 0 -1px 0 var(--border)',
      },
      '.cm-md-table': {
        position: 'relative',
        padding: '4px 16px 4px 8px',
      },
      '.cm-md-table-scroll': { overflowX: 'auto' },
      '.cm-md-table table': { borderCollapse: 'collapse' },
      '.cm-md-table th, .cm-md-table td': {
        border: '1px solid var(--border)',
        padding: '2px 10px',
        minWidth: '4em',
        whiteSpace: 'pre-wrap',
        outline: 'none',
        verticalAlign: 'top',
      },
      '.cm-md-table th': {
        fontWeight: '600',
        backgroundColor: MUTED,
      },
      '.cm-md-table :is(th, td):focus': {
        boxShadow: 'inset 0 0 0 1px var(--ring)',
      },
      '.cm-md-table-bar': {
        position: 'absolute',
        bottom: '100%',
        left: '8px',
        zIndex: '20',
        backgroundColor: 'var(--popover)',
        color: 'var(--popover-foreground)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
      },
    }),
  ]
}
