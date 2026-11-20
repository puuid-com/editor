import { diff } from '@codemirror/merge'

// A line diff shaped like git's: changed lines grouped into hunks, a few
// unchanged lines around each, and the rest folded away until asked for.

/** Old lines `fromA`–`toA` became new lines `fromB`–`toB` (indexes, end excluded). */
export interface LineChange {
  fromA: number
  toA: number
  fromB: number
  toB: number
}

export interface FileDiff {
  /** Lines of each side, without their line breaks. */
  a: ReadonlyArray<string>
  b: ReadonlyArray<string>
  changes: ReadonlyArray<LineChange>
  added: number
  removed: number
}

/** A stretch of a line, by character offsets. */
export interface Span {
  from: number
  to: number
}

type LineKind = 'context' | 'add' | 'del'

export interface DiffLine {
  kind: LineKind
  /** Index of the line on each side, or -1 on the side it isn't on. */
  a: number
  b: number
  /** Changed words, when the line was paired with the one it replaced. */
  marks?: ReadonlyArray<Span>
}

export interface HunkHeader {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
}

/** Which way a fold opens: toward the hunk below, above, or entirely. */
export type Reveal = 'up' | 'down' | 'all'

export type DiffRow =
  | {
      type: 'gap'
      gap: number
      hidden: number
      /** The hunk that follows; none for the fold after the last one. */
      header: HunkHeader | null
      /** The ways it can open: none toward a side with no hunk. */
      reveals: ReadonlyArray<Reveal>
    }
  | { type: 'line'; line: DiffLine }
  | { type: 'pair'; left: DiffLine | null; right: DiffLine | null }

export interface DiffRows {
  rows: ReadonlyArray<DiffRow>
  /** Row where each change starts, for moving from one to the next. */
  changeRows: ReadonlyArray<number>
  /** Longest line shown, in columns, so rows that don't wrap share a width. */
  widest: number
  /** Highest line number shown, for the width of the number columns. */
  lastLine: number
}

/** Lines folded open by each click on a fold. */
export const REVEAL_STEP = 20

/** Unchanged lines shown around each change, as git does. */
const CONTEXT = 3

/** Lines opened at the top and bottom of each fold, by its index. */
export type Revealed = ReadonlyMap<number, { top: number; bottom: number }>

// Distinct items a single UTF-16 code unit can stand for, skipping surrogates.
const MAX_TOKENS = 0x10000 - 0x800

function tokenChar(index: number) {
  return String.fromCharCode(index < 0xd800 ? index : index + 0x800)
}

/** Each item as one character, equal keys as the same one; null past the limit. */
function encode<T>(
  itemsA: ReadonlyArray<T>,
  itemsB: ReadonlyArray<T>,
  key: (item: T) => string,
): [string, string] | null {
  const tokens = new Map<string, string>()
  const run = (items: ReadonlyArray<T>) => {
    let out = ''
    for (const item of items) {
      const k = key(item)
      let token = tokens.get(k)
      if (token === undefined) {
        if (tokens.size >= MAX_TOKENS) return null
        token = tokenChar(tokens.size)
        tokens.set(k, token)
      }
      out += token
    }
    return out
  }
  const a = run(itemsA)
  if (a === null) return null
  const b = run(itemsB)
  return b === null ? null : [a, b]
}

/** The lines of `text`, without breaks; a final line break adds no line. */
export function splitLines(text: string): Array<string> {
  if (!text) return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  // Windows line breaks read the same as the others.
  return lines.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
}

const noSpace = (line: string) => line.replace(/\s+/g, '')
const asIs = (line: string) => line

/**
 * Which lines changed between `textA` and `textB`. With `ignoreWhitespace`,
 * lines that differ only in spaces and tabs count as the same, as with
 * `git diff -w`.
 */
export function diffLines(
  textA: string,
  textB: string,
  ignoreWhitespace = false,
): FileDiff {
  const a = splitLines(textA)
  const b = splitLines(textB)
  const key = ignoreWhitespace ? noSpace : asIs
  // The common start and end go first: most comparisons are a few edits in
  // a long file, and what's left has fewer distinct lines to tell apart.
  let start = 0
  while (
    start < a.length &&
    start < b.length &&
    key(a[start]) === key(b[start])
  )
    start++
  let endA = a.length
  let endB = b.length
  while (
    endA > start &&
    endB > start &&
    key(a[endA - 1]) === key(b[endB - 1])
  ) {
    endA--
    endB--
  }

  const changes: Array<LineChange> = []
  if (start < endA || start < endB) {
    const encoded = encode(a.slice(start, endA), b.slice(start, endB), key)
    if (!encoded) {
      changes.push({ fromA: start, toA: endA, fromB: start, toB: endB })
    } else {
      for (const c of diff(encoded[0], encoded[1], { timeout: 200 })) {
        changes.push({
          fromA: start + c.fromA,
          toA: start + c.toA,
          fromB: start + c.fromB,
          toB: start + c.toB,
        })
      }
    }
  }
  let added = 0
  let removed = 0
  for (const c of changes) {
    added += c.toB - c.fromB
    removed += c.toA - c.fromA
  }
  return { a, b, changes, added, removed }
}

const WORD = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu

/** Start offset of each item, plus the end. */
function offsets(items: ReadonlyArray<string>) {
  const starts = [0]
  for (const item of items) starts.push(starts.at(-1)! + item.length)
  return starts
}

const spanLength = (spans: ReadonlyArray<Span>) =>
  spans.reduce((sum, s) => sum + s.to - s.from, 0)

/** Lines longer than this together aren't compared word by word. */
const MARK_MAX = 4000

/**
 * The words that differ between a removed line and the line that replaced
 * it. Lines with little left in common get none: the whole line changed.
 */
export function wordMarks(
  a: string,
  b: string,
  ignoreWhitespace = false,
): { a: Array<Span>; b: Array<Span> } | null {
  if (a.length + b.length > MARK_MAX) return null
  const wordsA = a.match(WORD) ?? []
  const wordsB = b.match(WORD) ?? []
  const encoded = encode(wordsA, wordsB, asIs)
  if (!encoded) return null
  const startsA = offsets(wordsA)
  const startsB = offsets(wordsB)
  const spansA: Array<Span> = []
  const spansB: Array<Span> = []
  const keep = (text: string, span: Span) =>
    span.to > span.from &&
    !(ignoreWhitespace && !text.slice(span.from, span.to).trim())
  for (const c of diff(encoded[0], encoded[1])) {
    const spanA = { from: startsA[c.fromA], to: startsA[c.toA] }
    const spanB = { from: startsB[c.fromB], to: startsB[c.toB] }
    if (keep(a, spanA)) spansA.push(spanA)
    if (keep(b, spanB)) spansB.push(spanB)
  }
  const common = a.length - spanLength(spansA)
  if (common < Math.max(a.length, b.length) * 0.4) return null
  return { a: joinSpans(a, spansA), b: joinSpans(b, spansB) }
}

/** Joins marks one character apart, so `128.00` reads as one change. */
function joinSpans(text: string, spans: Array<Span>) {
  const out: Array<Span> = []
  for (const span of spans) {
    const last = out.at(-1)
    if (last && span.from - last.to <= 1 && !/\s/.test(text[last.to] ?? ''))
      last.to = span.to
    else out.push({ ...span })
  }
  return out
}

/** Columns a line takes, with tabs four wide as in the editor. */
function columns(line: string) {
  let tabs = 0
  for (let i = line.indexOf('\t'); i >= 0; i = line.indexOf('\t', i + 1)) tabs++
  return line.length + tabs * 3
}

// Word marks across the whole comparison stop past this many characters, so
// a file that changed everywhere stays quick to show.
const MARK_BUDGET = 400_000

/**
 * The rows to show for `fileDiff`: hunks of changed lines with unchanged
 * lines around them, and a fold between hunks for the rest. `unified` lists
 * removed lines, then added ones; `split` pairs them side by side.
 */
export function diffRows(
  fileDiff: FileDiff,
  layout: 'split' | 'unified',
  revealed: Revealed = new Map(),
  ignoreWhitespace = false,
): DiffRows {
  const { a, b, changes } = fileDiff
  const rows: Array<DiffRow> = []
  const changeRows: Array<number> = []
  let widest = 0
  let lastLine = 0
  let budget = MARK_BUDGET

  const context = (ia: number, ib: number) => {
    const line: DiffLine = { kind: 'context', a: ia, b: ib }
    widest = Math.max(widest, columns(b[ib]))
    if (layout === 'split') {
      widest = Math.max(widest, columns(a[ia]))
      rows.push({ type: 'pair', left: line, right: line })
    } else rows.push({ type: 'line', line })
    lastLine = Math.max(lastLine, ia + 1, ib + 1)
  }

  // Unchanged stretch `g` sits before change `g`; the last one ends the file.
  for (let g = 0; g <= changes.length; g++) {
    const prev = changes[g - 1] as LineChange | undefined
    const next = changes[g] as LineChange | undefined
    const startA = prev?.toA ?? 0
    const startB = prev?.toB ?? 0
    const length = (next?.fromA ?? a.length) - startA
    const open = revealed.get(g)
    const top = Math.min(length, (prev ? CONTEXT : 0) + (open?.top ?? 0))
    const bottom = Math.min(
      length - top,
      (next ? CONTEXT : 0) + (open?.bottom ?? 0),
    )
    // No changes at all: nothing to show around.
    if (!prev && !next) break
    for (let i = 0; i < top; i++) context(startA + i, startB + i)
    const hidden = length - top - bottom
    if (hidden > 0) {
      const reveals: Array<Reveal> =
        hidden <= REVEAL_STEP
          ? ['all']
          : [
              ...(next ? ['up' as const] : []),
              ...(prev ? ['down' as const] : []),
            ]
      rows.push({ type: 'gap', gap: g, hidden, header: null, reveals })
    }
    for (let i = length - bottom; i < length; i++)
      context(startA + i, startB + i)
    if (!next) break

    changeRows.push(rows.length)
    const dels = next.toA - next.fromA
    const adds = next.toB - next.fromB
    const marksA: Array<ReadonlyArray<Span> | undefined> = []
    const marksB: Array<ReadonlyArray<Span> | undefined> = []
    for (let k = 0; k < Math.min(dels, adds) && budget > 0; k++) {
      const lineA = a[next.fromA + k]
      const lineB = b[next.fromB + k]
      budget -= lineA.length + lineB.length
      const marks = wordMarks(lineA, lineB, ignoreWhitespace)
      marksA[k] = marks?.a
      marksB[k] = marks?.b
    }
    const del = (k: number): DiffLine => ({
      kind: 'del',
      a: next.fromA + k,
      b: -1,
      marks: marksA[k],
    })
    const add = (k: number): DiffLine => ({
      kind: 'add',
      a: -1,
      b: next.fromB + k,
      marks: marksB[k],
    })
    for (let k = 0; k < dels; k++)
      widest = Math.max(widest, columns(a[next.fromA + k]))
    for (let k = 0; k < adds; k++)
      widest = Math.max(widest, columns(b[next.fromB + k]))
    lastLine = Math.max(lastLine, next.toA, next.toB)
    if (layout === 'split') {
      for (let k = 0; k < Math.max(dels, adds); k++) {
        rows.push({
          type: 'pair',
          left: k < dels ? del(k) : null,
          right: k < adds ? add(k) : null,
        })
      }
    } else {
      for (let k = 0; k < dels; k++) rows.push({ type: 'line', line: del(k) })
      for (let k = 0; k < adds; k++) rows.push({ type: 'line', line: add(k) })
    }
  }

  // The first hunk gets its header too, with nothing above it to open.
  if (rows.length && rows[0].type !== 'gap') {
    rows.unshift({ type: 'gap', gap: -1, hidden: 0, header: null, reveals: [] })
    for (let i = 0; i < changeRows.length; i++) changeRows[i]++
  }
  addHeaders(rows)
  return { rows, changeRows, widest, lastLine }
}

/** The old and new lines a row shows, as `[a, b]` indexes or -1. */
function rowLines(row: DiffRow): [number, number] {
  if (row.type === 'line') return [row.line.a, row.line.b]
  if (row.type === 'pair') return [row.left?.a ?? -1, row.right?.b ?? -1]
  return [-1, -1]
}

/** Gives each fold the `@@ -a,n +b,m @@` header of the hunk below it. */
function addHeaders(rows: Array<DiffRow>) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type !== 'gap') continue
    let firstA = -1
    let firstB = -1
    let oldCount = 0
    let newCount = 0
    let j = i + 1
    for (; j < rows.length && rows[j].type !== 'gap'; j++) {
      const [la, lb] = rowLines(rows[j])
      if (la >= 0) {
        if (firstA < 0) firstA = la
        oldCount++
      }
      if (lb >= 0) {
        if (firstB < 0) firstB = lb
        newCount++
      }
    }
    if (j === i + 1) continue
    // Context keeps both sides in every hunk but where a side is empty,
    // which git numbers 0.
    rows[i] = {
      ...row,
      header: {
        oldStart: firstA + 1,
        oldCount,
        newStart: firstB + 1,
        newCount,
      },
    }
  }
}

/** `@@ -12,7 +12,8 @@`, as git prints it. */
export function hunkLabel(header: HunkHeader) {
  return `@@ -${header.oldStart},${header.oldCount} +${header.newStart},${header.newCount} @@`
}

/** Opens `step` more lines of fold `gap`, toward the hunk above or below. */
export function reveal(
  revealed: Revealed,
  gap: number,
  way: Reveal,
): Map<number, { top: number; bottom: number }> {
  const next = new Map(revealed)
  const open = next.get(gap) ?? { top: 0, bottom: 0 }
  next.set(
    gap,
    way === 'all'
      ? { top: Infinity, bottom: open.bottom }
      : way === 'down'
        ? { ...open, top: open.top + REVEAL_STEP }
        : { ...open, bottom: open.bottom + REVEAL_STEP },
  )
  return next
}

/** Five squares split between added and removed lines, as GitHub's diffstat. */
export function diffStat(added: number, removed: number) {
  const total = added + removed
  if (!total) return { added: 0, removed: 0, neutral: 5 }
  let green = Math.round((added / total) * 5)
  let red = Math.round((removed / total) * 5)
  if (added && !green) green = 1
  if (removed && !red) red = 1
  if (green + red > 5) {
    if (green > red) green = 5 - red
    else red = 5 - green
  }
  return { added: green, removed: red, neutral: 5 - green - red }
}
