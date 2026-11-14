// GFM tables as text: reading them, laying them out the way Prettier does, so
// Format leaves them alone, and the edits the Markdown editor offers.

export type TableAlign = 'left' | 'center' | 'right' | null

export interface MarkdownTable {
  /** The indent or quote markers before each line. */
  prefix: string
  aligns: Array<TableAlign>
  /** The header, then the body. */
  rows: Array<Array<string>>
}

export interface TableCell {
  row: number
  col: number
}

/** A table and the cell the caret goes to, after an edit. */
export interface TableEdit {
  table: MarkdownTable
  cell: TableCell
}

const PREFIX = /^[ \t>]*/

const prefixOf = (line: string) => PREFIX.exec(line)?.[0] ?? ''

/** Where each cell of a row sits in its line, whitespace included. */
function cellRanges(line: string) {
  const start = prefixOf(line).length
  const end = line.trimEnd().length
  const pipes: Array<number> = []
  for (let i = start; i < line.length; i++) {
    if (line[i] === '\\') i++
    else if (line[i] === '|') pipes.push(i)
  }
  const leading = pipes[0] === start
  const trailing = pipes.length > (leading ? 1 : 0) && pipes.at(-1) === end - 1
  const ranges: Array<{ from: number; to: number }> = []
  let from = leading ? start + 1 : start
  for (const pipe of pipes.slice(
    leading ? 1 : 0,
    trailing ? -1 : pipes.length,
  )) {
    ranges.push({ from, to: pipe })
    from = pipe + 1
  }
  ranges.push({ from, to: trailing ? end - 1 : line.length })
  return ranges
}

const cellsOf = (line: string) =>
  cellRanges(line).map(({ from, to }) => line.slice(from, to).trim())

function alignOf(cell: string): TableAlign {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (left) return 'left'
  return right ? 'right' : null
}

/** Reads a table from its lines: the header, the rule, then the body. */
export function parseTable(lines: ReadonlyArray<string>): MarkdownTable {
  return {
    prefix: prefixOf(lines[0]),
    aligns: cellsOf(lines[1]).map(alignOf),
    rows: [lines[0], ...lines.slice(2)].map(cellsOf),
  }
}

function pad(text: string, width: number, align: TableAlign) {
  const space = width - text.length
  if (align === 'right') return ' '.repeat(space) + text
  if (align !== 'center') return text + ' '.repeat(space)
  const left = Math.floor(space / 2)
  return ' '.repeat(left) + text + ' '.repeat(space - left)
}

function rule(width: number, align: TableAlign) {
  if (align === 'center') return `:${'-'.repeat(width - 2)}:`
  if (align === 'left') return `:${'-'.repeat(width - 1)}`
  return align === 'right' ? `${'-'.repeat(width - 1)}:` : '-'.repeat(width)
}

/**
 * The table's lines with its columns aligned. A row with too few cells gets
 * empty ones, and one with too many widens the table, so no text is lost.
 */
export function formatTable({
  prefix,
  aligns,
  rows,
}: MarkdownTable): Array<string> {
  // Read each cell once, without passing one function argument per row.
  // Spreading large tables into Math.max exceeds the engine's argument limit.
  const widths = Array.from({ length: aligns.length }, () => 3)
  for (const cells of rows) {
    for (let col = 0; col < cells.length; col++) {
      widths[col] = Math.max(widths[col] ?? 3, cells[col].length)
    }
  }
  const align = (col: number): TableAlign => aligns[col] ?? null
  const line = (cells: Array<string>) => `${prefix}| ${cells.join(' | ')} |`
  const row = (cells: Array<string>) =>
    line(widths.map((width, col) => pad(cells[col] ?? '', width, align(col))))
  return [
    row(rows[0]),
    line(widths.map((width, col) => rule(width, align(col)))),
    ...rows.slice(1).map(row),
  ]
}

/** The line a row is on, the rule being the second. */
export const lineOfRow = (row: number) => (row === 0 ? 0 : row + 1)

/** The row a line belongs to; the rule counts as the header. */
export const rowOfLine = (line: number) => (line <= 1 ? 0 : line - 1)

/** The column of the cell around `ch` in a row's line. */
export function columnAt(line: string, ch: number) {
  const ranges = cellRanges(line)
  const col = ranges.findIndex(({ to }) => ch <= to)
  return col < 0 ? ranges.length - 1 : col
}

/** Where a cell's text sits in its line; just past the pipe when empty. */
export function cellText(line: string, col: number) {
  const { from, to } = cellRanges(line)[col]
  const text = line.slice(from, to)
  if (!text.trim()) {
    const at = Math.min(from + 1, to)
    return { from: at, to: at }
  }
  return {
    from: from + text.length - text.trimStart().length,
    to: from + text.trimEnd().length,
  }
}

/**
 * Aligns a table being typed in, with the caret at `ch` of line `line`. The
 * space just typed in the caret's cell stays, or "New York" could never be
 * written. Null when it should stay as typed: on the rule, or while the rows
 * disagree on the number of cells, since a pipe has just gone in or out.
 */
export function realign(
  lines: ReadonlyArray<string>,
  line: number,
  ch: number,
): { lines: Array<string>; ch: number } | null {
  if (line === 1) return null
  const counts = lines.map((text) => cellRanges(text).length)
  if (counts.some((count) => count !== counts[0])) return null
  const col = columnAt(lines[line], ch)
  const { from, to } = cellRanges(lines[line])[col]
  if (ch < from || ch > to) return null
  const before = lines[line].slice(from, ch).trimStart()
  const after = lines[line].slice(ch, to).trimEnd()
  const table = parseTable(lines)
  table.rows[rowOfLine(line)][col] = (before + after).trimStart()
  const next = formatTable(table)
  return {
    lines: next,
    ch: cellText(next[line], col).from + before.length,
  }
}

const emptyRow = (cols: number) => Array.from({ length: cols }, () => '')

/** A blank table; `rows` counts the header. */
export function emptyTable(
  prefix: string,
  cols: number,
  rows: number,
): MarkdownTable {
  return {
    prefix,
    aligns: Array.from({ length: cols }, () => null),
    rows: Array.from({ length: rows }, () => emptyRow(cols)),
  }
}

/** The table a typed `| a | b |` line starts, with a blank row, if it does. */
export function tableFromHeader(line: string): MarkdownTable | null {
  const start = prefixOf(line).length
  const end = line.trimEnd().length - 1
  const closed =
    end > start && line[start] === '|' && cellRanges(line).at(-1)?.to === end
  const cells = cellsOf(line)
  if (!closed || !cells.some(Boolean)) return null
  return {
    prefix: prefixOf(line),
    aligns: cells.map(() => null),
    rows: [cells, emptyRow(cells.length)],
  }
}

export const columnCount = (table: MarkdownTable) =>
  table.rows.reduce(
    (count, row) => Math.max(count, row.length),
    table.aligns.length,
  )

/** Adds a blank row below `cell`'s; the caret starts the new row. */
export function addRow(table: MarkdownTable, { row }: TableCell): TableEdit {
  const rows = [...table.rows]
  rows.splice(row + 1, 0, emptyRow(columnCount(table)))
  return { table: { ...table, rows }, cell: { row: row + 1, col: 0 } }
}

/** Adds a blank column to the right of `cell`'s and moves the caret into it. */
export function addColumn(
  table: MarkdownTable,
  { row, col }: TableCell,
): TableEdit {
  const widen = <T>(cells: ReadonlyArray<T>, blank: T) => {
    const next = [...cells]
    while (next.length <= col) next.push(blank)
    next.splice(col + 1, 0, blank)
    return next
  }
  return {
    table: {
      ...table,
      aligns: widen<TableAlign>(table.aligns, null),
      rows: table.rows.map((cells) => widen(cells, '')),
    },
    cell: { row, col: col + 1 },
  }
}

/** Removes `cell`'s row. The header can't go, or it would no longer be a table. */
export function removeRow(table: MarkdownTable, { row, col }: TableCell) {
  if (row === 0) return { table, cell: { row, col } }
  const rows = table.rows.filter((_, index) => index !== row)
  return {
    table: { ...table, rows },
    cell: { row: Math.min(row, rows.length - 1), col },
  }
}

/** Removes `cell`'s column, unless it is the only one. */
export function removeColumn(
  table: MarkdownTable,
  { row, col }: TableCell,
): TableEdit {
  if (columnCount(table) < 2) return { table, cell: { row, col } }
  const drop = <T>(cells: ReadonlyArray<T>) =>
    cells.filter((_, index) => index !== col)
  return {
    table: {
      ...table,
      aligns: drop(table.aligns),
      rows: table.rows.map(drop),
    },
    cell: { row, col: Math.max(0, col - 1) },
  }
}

/** Aligns `cell`'s column. */
export function alignColumn(
  table: MarkdownTable,
  cell: TableCell,
  align: TableAlign,
): TableEdit {
  const aligns = [...table.aligns]
  while (aligns.length <= cell.col) aligns.push(null)
  aligns[cell.col] = align
  return { table: { ...table, aligns }, cell }
}
