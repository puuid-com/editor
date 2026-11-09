import { completionStatus, pickedCompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { EditorState, Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView, keymap, showTooltip } from '@codemirror/view'
import { createRoot } from 'react-dom/client'
import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete'
import type { Language } from '@codemirror/language'
import type {
  ChangeSpec,
  Extension,
  Text,
  TransactionSpec,
} from '@codemirror/state'
import type { KeyBinding, Tooltip, TooltipView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

import {
  PICKER_COLS,
  PICKER_ROWS,
  TablePicker,
  TableToolbar,
} from './TableControls'
import type { TableToolbarActions, TableToolbarInfo } from './TableControls'
import {
  addColumn,
  addRow,
  alignColumn,
  cellText,
  columnAt,
  columnCount,
  emptyTable,
  formatTable,
  lineOfRow,
  parseTable,
  realign,
  removeColumn,
  removeRow,
  rowOfLine,
  tableFromHeader,
} from '#/lib/markdown-table'
import type {
  MarkdownTable,
  TableAlign,
  TableCell,
  TableEdit,
} from '#/lib/markdown-table'
import { isGridTable } from './md-live-blocks'
import { m } from '#/paraglide/messages'

// Helpers for writing GFM tables in the Markdown editor: `/table` opens a size
// grid, a typed `| a | b |` line becomes a table on Enter, Tab and Enter move
// around the cells, columns stay aligned while typing, and a toolbar edits the
// table around the caret.

/** A table in the document, as whole lines. */
interface FoundTable {
  from: number
  to: number
  /** The document line number of its header. */
  firstLine: number
  lines: Array<string>
}

function foundIn(doc: Text, from: number, to: number): FoundTable {
  const first = doc.lineAt(from)
  const last = doc.lineAt(to)
  const lines: Array<string> = []
  for (let n = first.number; n <= last.number; n++) lines.push(doc.line(n).text)
  return { from: first.from, to: last.to, firstLine: first.number, lines }
}

/** The nearest node at `pos` that `matches`, walking up the syntax tree. */
function closest(
  state: EditorState,
  pos: number,
  side: 1 | -1,
  matches: (name: string) => boolean,
) {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side)
  while (node && !matches(node.name)) node = node.parent
  return node
}

const isTable = (name: string) => name === 'Table'

/** The table around `pos`, if any. */
function tableAt(state: EditorState, pos: number): FoundTable | null {
  const node =
    closest(state, pos, 1, isTable) ?? closest(state, pos, -1, isTable)
  return node && foundIn(state.doc, node.from, node.to)
}

/** The table holding a lone caret or a selection within one, and the cell. */
function tableAtCaret(state: EditorState) {
  if (state.selection.ranges.length > 1) return null
  const { from, to, head } = state.selection.main
  const found = tableAt(state, head)
  if (!found || from < found.from || to > found.to) return null
  // Live preview's grid has its own keys and toolbar.
  if (isGridTable(state, found.from)) return null
  const line = state.doc.lineAt(head)
  const cell: TableCell = {
    row: rowOfLine(line.number - found.firstLine),
    col: columnAt(line.text, head - line.from),
  }
  return { found, cell }
}

/** The changes turning `found` into `lines`, by the line when they can be. */
function linesChanges(found: FoundTable, lines: Array<string>) {
  if (lines.length !== found.lines.length)
    return [{ from: found.from, to: found.to, insert: lines.join('\n') }]
  const changes: Array<ChangeSpec> = []
  let from = found.from
  found.lines.forEach((line, index) => {
    if (line !== lines[index])
      changes.push({ from, to: from + line.length, insert: lines[index] })
    from += line.length + 1
  })
  return changes
}

/** Where line `index` starts, in a document that has `lines` from `from`. */
function lineStart(lines: ReadonlyArray<string>, from: number, index: number) {
  return lines
    .slice(0, index)
    .reduce((pos, line) => pos + line.length + 1, from)
}

/** Writes `table` over `found`, with the caret at the end of `cell`'s text. */
function writeTable(
  found: FoundTable,
  { table, cell }: TableEdit,
): TransactionSpec {
  const lines = formatTable(table)
  const line = lineOfRow(cell.row)
  return {
    changes: linesChanges(found, lines),
    selection: {
      anchor:
        lineStart(lines, found.from, line) + cellText(lines[line], cell.col).to,
    },
    scrollIntoView: true,
    userEvent: 'input',
  }
}

/* ---------------- Keys ---------------- */

const completing = (state: EditorState) => completionStatus(state) === 'active'

/** Tab and Shift-Tab: the next or previous cell; past the last, a new row. */
function moveCell(step: 1 | -1) {
  return (view: EditorView) => {
    const { state } = view
    if (completing(state)) return false
    const at = tableAtCaret(state)
    if (!at) return false
    const table = parseTable(at.found.lines)
    const cols = columnCount(table)
    const index = at.cell.row * cols + at.cell.col + step
    // Nowhere to go before the first cell, but Tab still shouldn't indent.
    if (index < 0) return true
    const edit =
      index >= table.rows.length * cols
        ? addRow(table, { row: table.rows.length - 1, col: 0 })
        : {
            table,
            cell: { row: Math.floor(index / cols), col: index % cols },
          }
    view.dispatch(writeTable(at.found, edit))
    return true
  }
}

/** Enter in a table: a new row below; on an empty last row, out of the table. */
function enterInTable(
  view: EditorView,
  at: { found: FoundTable; cell: TableCell },
) {
  const { found, cell } = at
  const table = parseTable(found.lines)
  const last = table.rows.length - 1
  if (cell.row > 0 && cell.row === last && !table.rows[last].some(Boolean)) {
    const lines = formatTable({ ...table, rows: table.rows.slice(0, last) })
    // A blank line between, or what's typed next would be another row.
    const text = `${lines.join('\n')}\n\n`
    view.dispatch({
      changes: { from: found.from, to: found.to, insert: text },
      selection: { anchor: found.from + text.length },
      scrollIntoView: true,
      userEvent: 'input',
    })
    return true
  }
  view.dispatch(writeTable(found, addRow(table, cell)))
  return true
}

/** Enter at the end of a lone `| a | b |` line: the rule and a blank row. */
function enterAfterHeader(view: EditorView) {
  const { state } = view
  const { main } = state.selection
  if (!main.empty) return false
  const line = state.doc.lineAt(main.head)
  if (main.head < line.from + line.text.trimEnd().length) return false
  const table = tableFromHeader(line.text)
  if (!table) return false
  // A paragraph of just this line: not code, and no text it would have to
  // follow, since a table can't start in the middle of a paragraph.
  const start = line.from + table.prefix.length
  const paragraph = closest(state, start, 1, (name) => name === 'Paragraph')
  if (
    paragraph?.from !== start ||
    state.doc.lineAt(paragraph.to).number !== line.number
  )
    return false
  view.dispatch(
    writeTable(
      {
        from: line.from,
        to: line.to,
        firstLine: line.number,
        lines: [line.text],
      },
      { table, cell: { row: 1, col: 0 } },
    ),
  )
  return true
}

function enter(view: EditorView) {
  if (completing(view.state)) return false
  const at = tableAtCaret(view.state)
  return at ? enterInTable(view, at) : enterAfterHeader(view)
}

/** Before the keys that continue lists and quotes, which tables can sit in. */
export const tableKeymap: ReadonlyArray<KeyBinding> = [
  { key: 'Tab', run: moveCell(1), shift: moveCell(-1) },
  { key: 'Enter', run: enter },
]

/* ---------------- Alignment while typing ---------------- */

/**
 * Keeps a table's columns aligned as its cells are typed in. Only touches
 * plain typing and deleting on one line of a table: pastes and edits across
 * lines stay as they are, and text being composed isn't disturbed.
 */
const alignWhileTyping = EditorState.transactionFilter.of((tr) => {
  if (
    !tr.docChanged ||
    tr.isUserEvent('input.type.compose') ||
    !(tr.isUserEvent('input.type') || tr.isUserEvent('delete'))
  )
    return tr
  const { main, ranges } = tr.newSelection
  if (ranges.length > 1 || !main.empty) return tr
  const old = tableAt(tr.startState, tr.startState.selection.main.head)
  if (!old) return tr
  const from = tr.changes.mapPos(old.from, -1)
  const to = tr.changes.mapPos(old.to, 1)
  const { newDoc } = tr
  if (main.head < from || main.head > to) return tr
  const found = foundIn(newDoc, from, to)
  if (
    found.from !== from ||
    found.to !== to ||
    found.lines.length !== old.lines.length
  )
    return tr
  const caretLine = newDoc.lineAt(main.head)
  const line = caretLine.number - found.firstLine
  const next = realign(found.lines, line, main.head - caretLine.from)
  if (!next) return tr
  const changes = linesChanges(found, next.lines)
  if (!changes.length) return tr
  return [
    tr,
    {
      changes,
      selection: { anchor: lineStart(next.lines, from, line) + next.ch },
      sequential: true,
    },
  ]
})

/* ---------------- /table and its size grid ---------------- */

interface Picker {
  pos: number
  cols: number
  rows: number
}

const openPicker = StateEffect.define<number>()
const sizePicker = StateEffect.define<{ cols: number; rows: number }>()
const closePicker = StateEffect.define<null>()

const pickerField = StateField.define<Picker | null>({
  create: () => null,
  update(picker, tr) {
    let next = tr.docChanged || tr.selection ? null : picker
    for (const effect of tr.effects) {
      if (effect.is(openPicker)) next = { pos: effect.value, cols: 3, rows: 3 }
      else if (effect.is(closePicker)) next = null
      else if (effect.is(sizePicker) && next)
        next = { ...next, ...effect.value }
    }
    return next
  },
  provide: (field) =>
    showTooltip.from(
      field,
      (picker) => picker && { pos: picker.pos, create: pickerView },
    ),
})

/** Replaces the empty line the picker sits on with a blank table. */
function insertPicked(view: EditorView) {
  const picker = view.state.field(pickerField, false)
  if (!picker) return false
  const { doc } = view.state
  const line = doc.lineAt(picker.pos)
  const prefix = line.text
  const lines = formatTable(emptyTable(prefix, picker.cols, picker.rows))
  // Blank lines around it, as a table reads and markdownlint wants, except in
  // a quote or list, where they would end it.
  const blank = (number: number) =>
    number < 1 || number > doc.lines || !doc.line(number).text.trim()
  const before = !prefix && !blank(line.number - 1) ? '\n' : ''
  const after = !prefix && !blank(line.number + 1) ? '\n' : ''
  view.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: before + lines.join('\n') + after,
    },
    selection: {
      anchor: line.from + before.length + cellText(lines[0], 0).from,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })
  return true
}

function pickerView(view: EditorView): TooltipView {
  const dom = document.createElement('div')
  const root = createRoot(dom)
  const render = () => {
    const picker = view.state.field(pickerField, false)
    if (!picker) return
    root.render(
      <TablePicker
        cols={picker.cols}
        rows={picker.rows}
        onHover={(cols, rows) =>
          view.dispatch({ effects: sizePicker.of({ cols, rows }) })
        }
        onPick={() => insertPicked(view)}
      />,
    )
  }
  render()
  return {
    dom,
    offset: { x: 0, y: 4 },
    update: render,
    // Later, as CodeMirror can get here while React is committing.
    destroy: () => queueMicrotask(() => root.unmount()),
  }
}

/** Arrow keys size the grid, Enter inserts the table, Escape closes it. */
function resize(cols: number, rows: number) {
  return ({ state, dispatch }: EditorView) => {
    const picker = state.field(pickerField, false)
    if (!picker) return false
    dispatch({
      effects: sizePicker.of({
        cols: Math.min(PICKER_COLS, Math.max(1, picker.cols + cols)),
        rows: Math.min(PICKER_ROWS, Math.max(1, picker.rows + rows)),
      }),
    })
    return true
  }
}

const pickerKeys = Prec.highest(
  keymap.of([
    { key: 'ArrowLeft', run: resize(-1, 0) },
    { key: 'ArrowRight', run: resize(1, 0) },
    { key: 'ArrowUp', run: resize(0, -1) },
    { key: 'ArrowDown', run: resize(0, 1) },
    { key: 'Enter', run: insertPicked },
    { key: 'Tab', run: insertPicked },
    {
      key: 'Escape',
      run: ({ state, dispatch }) => {
        if (!state.field(pickerField, false)) return false
        dispatch({ effects: closePicker.of(null) })
        return true
      },
    },
  ]),
)

/** The grid goes away with the focus. */
const closePickerOnBlur = EditorView.focusChangeEffect.of((state, focusing) =>
  !focusing && state.field(pickerField, false) ? closePicker.of(null) : null,
)

const CODE = new Set(['FencedCode', 'CodeBlock', 'HTMLBlock', 'CommentBlock'])

const inCode = (state: EditorState, pos: number) =>
  closest(state, pos, -1, (name) => CODE.has(name)) !== null

/** Offers `/table` on an otherwise empty line. */
function tableCompletion(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  if (context.pos !== line.to) return null
  const typed = /^[ \t>]*(\/\w*)$/.exec(line.text)?.[1]
  if (!typed || inCode(context.state, context.pos)) return null
  const option: Completion = {
    label: '/table',
    detail: m.md_table_insert(),
    apply: (view, completion, from, to) =>
      view.dispatch({
        changes: { from, to },
        selection: { anchor: from },
        effects: openPicker.of(from),
        annotations: pickedCompletion.of(completion),
      }),
  }
  return {
    from: context.pos - typed.length,
    options: [option],
    validFor: /^\/\w*$/,
  }
}

/* ---------------- The toolbar ---------------- */

function toolbarInfo(state: EditorState): TableToolbarInfo | null {
  const at = tableAtCaret(state)
  if (!at) return null
  const table = parseTable(at.found.lines)
  return {
    align: table.aligns[at.cell.col] ?? null,
    isHeader: at.cell.row === 0,
    isOnlyColumn: columnCount(table) < 2,
  }
}

function editTable(
  view: EditorView,
  edit: (table: MarkdownTable, cell: TableCell) => TableEdit,
) {
  const at = tableAtCaret(view.state)
  if (!at) return
  view.dispatch(writeTable(at.found, edit(parseTable(at.found.lines), at.cell)))
}

/** Removes the table around the caret and the blank line below it. */
function deleteTable(view: EditorView) {
  const at = tableAtCaret(view.state)
  if (!at) return
  const { doc } = view.state
  const { from, to } = at.found
  const next = to < doc.length ? doc.lineAt(to + 1) : null
  view.dispatch({
    changes: { from, to: next && !next.text.trim() ? next.to : to },
    selection: { anchor: from },
    userEvent: 'delete',
  })
}

const BAR_GAP = 4

function toolbarView(view: EditorView): TooltipView {
  const dom = document.createElement('div')
  const root = createRoot(dom)
  let menuOpen = false
  const show = () => {
    dom.style.visibility = view.hasFocus || menuOpen ? '' : 'hidden'
  }
  const actions: TableToolbarActions = {
    addRow: () => editTable(view, addRow),
    addColumn: () => editTable(view, addColumn),
    align: (align: TableAlign) =>
      editTable(view, (table, cell) => alignColumn(table, cell, align)),
    deleteRow: () => editTable(view, removeRow),
    deleteColumn: () => editTable(view, removeColumn),
    deleteTable: () => deleteTable(view),
    onMenuOpenChange: (open) => {
      menuOpen = open
      show()
    },
    onMenuClosed: () => view.focus(),
  }
  const render = () => {
    const info = toolbarInfo(view.state)
    if (info) root.render(<TableToolbar info={info} actions={actions} />)
  }
  render()
  show()
  return {
    dom,
    offset: { x: 0, y: BAR_GAP },
    update(update) {
      if (update.docChanged || update.selectionSet) render()
      if (update.focusChanged) show()
    },
    // Above the table; pinned to the top of the editor once that scrolls away,
    // and below the caret's line when pinning would hide it.
    getCoords(pos) {
      const { state, documentTop, scrollDOM, contentDOM } = view
      const editor = scrollDOM.getBoundingClientRect()
      const left = contentDOM.getBoundingClientRect().left + 8
      const height = dom.offsetHeight + BAR_GAP
      const line = view.lineBlockAt(pos)
      const tableTop = documentTop + line.top
      const end = tableAtCaret(state)?.found.to ?? pos
      const tableBottom = documentTop + view.lineBlockAt(end).bottom
      const place = (top: number) => ({ left, right: left, top, bottom: top })
      // Off screen, so CodeMirror hides it.
      if (tableBottom <= editor.top) return place(tableBottom)
      if (tableTop >= editor.bottom) return place(tableTop)
      let barTop = tableTop - height
      if (barTop < editor.top + BAR_GAP) {
        const caret = view.lineBlockAt(state.selection.main.head)
        const caretTop = documentTop + caret.top
        const caretBottom = documentTop + caret.bottom
        barTop = editor.top + BAR_GAP
        if (caretTop < barTop + height && caretBottom > barTop)
          barTop = caretBottom + BAR_GAP
      }
      return place(barTop + height)
    },
    destroy: () => queueMicrotask(() => root.unmount()),
  }
}

const tableToolbar = showTooltip.compute(
  ['doc', 'selection'],
  (state): Tooltip | null => {
    const at = tableAtCaret(state)
    return at
      ? {
          pos: at.found.from,
          above: true,
          strictSide: true,
          create: toolbarView,
        }
      : null
  },
)

export function markdownTables(language: Language): Extension {
  return [
    alignWhileTyping,
    language.data.of({ autocomplete: tableCompletion }),
    pickerField,
    pickerKeys,
    closePickerOnBlur,
    tableToolbar,
  ]
}
