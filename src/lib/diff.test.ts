import { describe, expect, it } from 'vitest'

import {
  REVEAL_STEP,
  diffLines,
  diffRows,
  diffStat,
  hunkLabel,
  reveal,
  splitLines,
  wordMarks,
} from './diff'
import type { DiffRow, LineChange } from './diff'

function records(count: number, change = (i: number) => String(i)) {
  const rows = Array.from(
    { length: count },
    (_, i) =>
      `  <record id="${i}">\n    <name>Item ${change(i)}</name>\n    <qty>${i % 7}</qty>\n  </record>`,
  )
  return `<records>\n${rows.join('\n')}\n</records>\n`
}

/** Rebuilds `b`'s lines from `a`'s and the changes, to check they agree. */
function apply(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
  changes: ReadonlyArray<LineChange>,
) {
  const out: Array<string> = []
  let pos = 0
  for (const c of changes) {
    out.push(...a.slice(pos, c.fromA), ...b.slice(c.fromB, c.toB))
    pos = c.toA
  }
  return [...out, ...a.slice(pos)]
}

const numbered = (count: number, edit: Record<number, string> = {}) =>
  Array.from({ length: count }, (_, i) => edit[i + 1] ?? `line ${i + 1}`).join(
    '\n',
  )

/** Each row as git would print it, folds as their header. */
function print(rows: ReadonlyArray<DiffRow>, a: string, b: string) {
  const linesA = splitLines(a)
  const linesB = splitLines(b)
  return rows.map((row) => {
    if (row.type === 'gap')
      return row.header ? hunkLabel(row.header) : `… ${row.hidden}`
    if (row.type === 'pair')
      return `${row.left ? linesA[row.left.a] : ''} | ${row.right ? linesB[row.right.b] : ''}`
    const { kind } = row.line
    if (kind === 'del') return `-${linesA[row.line.a]}`
    return `${kind === 'add' ? '+' : ' '}${linesB[row.line.b]}`
  })
}

describe('splitLines', () => {
  it('drops the final line break and Windows carriage returns', () => {
    expect(splitLines('')).toEqual([])
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b'])
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b'])
  })
})

describe('diffLines', () => {
  it('counts added and removed lines', () => {
    const result = diffLines('a\nb\nc\n', 'a\nB\nc\nd\n')
    expect(result.changes).toEqual([
      { fromA: 1, toA: 2, fromB: 1, toB: 2 },
      { fromA: 3, toA: 3, fromB: 3, toB: 4 },
    ])
    expect(result.added).toBe(2)
    expect(result.removed).toBe(1)
  })

  it('handles an empty side', () => {
    expect(diffLines('', 'a\nb').changes).toEqual([
      { fromA: 0, toA: 0, fromB: 0, toB: 2 },
    ])
    expect(diffLines('a', '').removed).toBe(1)
    expect(diffLines('', '').changes).toEqual([])
  })

  it('can count lines that differ only in whitespace as the same', () => {
    const a = '<r>\n  <a>1</a>\n</r>'
    const b = '<r>\n\t<a>1</a>  \n</r>'
    expect(diffLines(a, b).changes).toHaveLength(1)
    expect(diffLines(a, b, true).changes).toEqual([])
  })
})

describe('diffRows', () => {
  it('folds unchanged lines away from three lines of context', () => {
    const a = numbered(20)
    const b = numbered(20, { 10: 'line ten' })
    const { rows, changeRows } = diffRows(diffLines(a, b), 'unified')
    expect(print(rows, a, b)).toEqual([
      '@@ -7,7 +7,7 @@',
      ' line 7',
      ' line 8',
      ' line 9',
      '-line 10',
      '+line ten',
      ' line 11',
      ' line 12',
      ' line 13',
      '… 7',
    ])
    expect(rows[0]).toMatchObject({ hidden: 6, reveals: ['all'] })
    expect(changeRows).toEqual([4])
  })

  it('gives the first hunk a header with nothing to open', () => {
    const a = 'a\nb\nc'
    const b = 'a\nB\nc'
    const { rows } = diffRows(diffLines(a, b), 'unified')
    expect(rows[0]).toMatchObject({ type: 'gap', hidden: 0, reveals: [] })
    expect(print(rows, a, b)[0]).toBe('@@ -1,3 +1,3 @@')
  })

  it('numbers an empty side 0, as git does', () => {
    const { rows } = diffRows(diffLines('', 'a\nb'), 'unified')
    expect(print(rows, '', 'a\nb')).toEqual(['@@ -0,0 +1,2 @@', '+a', '+b'])
  })

  it('pairs removed and added lines in the split layout', () => {
    const a = 'x\nold 1\nold 2\ny'
    const b = 'x\nnew 1\ny'
    const { rows } = diffRows(diffLines(a, b), 'split')
    expect(print(rows, a, b)).toEqual([
      '@@ -1,4 +1,3 @@',
      'x | x',
      'old 1 | new 1',
      'old 2 | ',
      'y | y',
    ])
  })

  it('opens a fold step by step, toward either hunk', () => {
    const a = numbered(100)
    const b = numbered(100, { 2: 'two', 99: 'ninety-nine' })
    const fileDiff = diffLines(a, b)
    const fold = (revealed = new Map()) =>
      diffRows(fileDiff, 'unified', revealed).rows.find(
        (row) => row.type === 'gap' && row.hidden > 0,
      )
    const closed = fold()
    expect(closed).toMatchObject({ hidden: 90, reveals: ['up', 'down'] })
    const gap = closed?.type === 'gap' ? closed.gap : -1

    const down = reveal(new Map(), gap, 'down')
    expect(fold(down)).toMatchObject({ hidden: 90 - REVEAL_STEP })
    const both = reveal(down, gap, 'up')
    expect(fold(both)).toMatchObject({ hidden: 90 - 2 * REVEAL_STEP })
    expect(fold(reveal(both, gap, 'all'))).toBeUndefined()
  })

  it('marks the words that changed in a replaced line', () => {
    const a = '<r>\n  <status>pending</status>\n</r>'
    const b = '<r>\n  <status>shipped</status>\n</r>'
    const { rows } = diffRows(diffLines(a, b), 'unified')
    const marked = rows.flatMap((row) =>
      row.type === 'line' && row.line.marks
        ? [
            row.line.marks.map((s) =>
              splitLines(row.line.kind === 'del' ? a : b)[
                row.line.kind === 'del' ? row.line.a : row.line.b
              ].slice(s.from, s.to),
            ),
          ]
        : [],
    )
    expect(marked).toEqual([['pending'], ['shipped']])
  })
})

describe('wordMarks', () => {
  it('leaves lines with little in common unmarked', () => {
    expect(wordMarks('<a>1</a>', 'completely different text')).toBeNull()
  })

  it('skips whitespace changes when they are hidden', () => {
    expect(wordMarks('a  b c', 'a b d', true)).toEqual({
      a: [{ from: 5, to: 6 }],
      b: [{ from: 4, to: 5 }],
    })
  })
})

describe('diffStat', () => {
  it('splits five squares between added and removed lines', () => {
    expect(diffStat(0, 0)).toEqual({ added: 0, removed: 0, neutral: 5 })
    expect(diffStat(10, 0)).toEqual({ added: 5, removed: 0, neutral: 0 })
    expect(diffStat(1, 100)).toEqual({ added: 1, removed: 4, neutral: 0 })
    expect(diffStat(3, 2)).toEqual({ added: 3, removed: 2, neutral: 0 })
  })
})

describe('diffing large files', () => {
  it('finds a few changes in a large file quickly', () => {
    const a = records(20_000)
    const b = records(20_000, (i) =>
      i % 5000 === 0 ? `${i} (edited)` : `${i}`,
    )
    expect(a.length).toBeGreaterThan(1_500_000)
    const start = performance.now()
    const result = diffLines(a, b)
    const { rows } = diffRows(result, 'split')
    expect(performance.now() - start).toBeLessThan(1000)
    expect(result.changes).toHaveLength(4)
    expect(apply(result.a, result.b, result.changes)).toEqual(result.b)
    expect(rows.length).toBeLessThan(50)
  })

  it('keeps many small edits apart', () => {
    const a = records(20_000)
    const b = records(20_000, (i) => (i % 50 === 0 ? `${i}x` : `${i}`))
    const result = diffLines(a, b)
    expect(result.changes).toHaveLength(400)
    expect(apply(result.a, result.b, result.changes)).toEqual(result.b)
  })

  it('stays quick on very different files', () => {
    const a = records(20_000)
    const b = records(20_000, (i) => `${(i * 7919) % 20_000}`)
    const start = performance.now()
    const result = diffLines(a, b)
    diffRows(result, 'unified')
    expect(performance.now() - start).toBeLessThan(2000)
    expect(apply(result.a, result.b, result.changes)).toEqual(result.b)
  })
})
