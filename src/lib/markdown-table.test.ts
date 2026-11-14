import { describe, expect, it } from 'vitest'

import {
  addColumn,
  addRow,
  alignColumn,
  cellText,
  columnAt,
  columnCount,
  emptyTable,
  formatTable,
  parseTable,
  realign,
  removeColumn,
  removeRow,
  tableFromHeader,
} from './markdown-table'
import { formatMarkdown } from './markdown-format'

const TABLE = [
  '| Name  | Role    |',
  '| ----- | ------- |',
  '| Ada   | Eng     |',
  '| Grace | Admiral |',
]

describe('reading and laying out tables', () => {
  it('reads cells and alignments', () => {
    expect(
      parseTable(['a | b | c', ':-- | :-: | --:', '| 1 | 2 | 3 |']),
    ).toEqual({
      prefix: '',
      aligns: ['left', 'center', 'right'],
      rows: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
  })

  it('keeps escaped pipes in their cell', () => {
    const { rows } = parseTable(['| [[Note\\|Alias]] | b |', '| - | - |'])
    expect(rows[0]).toEqual(['[[Note\\|Alias]]', 'b'])
  })

  it('keeps a quote prefix on every line', () => {
    expect(
      formatTable(parseTable(['> | a | b |', '> | - | - |', '> | 1 | 2 |'])),
    ).toEqual(['> | a   | b   |', '> | --- | --- |', '> | 1   | 2   |'])
  })

  it('pads to the alignment, with columns at least three wide', () => {
    expect(
      formatTable(
        parseTable(['| a | b | c | longer |', '|:-|:-:|-:|-|', '|1|2|3|4|']),
      ),
    ).toEqual([
      '| a   |  b  |   c | longer |',
      '| :-- | :-: | --: | ------ |',
      '| 1   |  2  |   3 | 4      |',
    ])
  })

  it('never loses a cell from a row that is too long', () => {
    expect(formatTable(parseTable(['| a |', '| - |', '| 1 | 2 |']))).toEqual([
      '| a   |     |',
      '| --- | --- |',
      '| 1   | 2   |',
    ])
  })

  it('sizes and formats tables beyond the JavaScript function argument limit', () => {
    const rows = Array.from({ length: 150_000 }, () => ['x'])
    rows.push(['longest', 'last'])
    const table = { prefix: '', aligns: [], rows }
    expect(columnCount(table)).toBe(2)
    const lines = formatTable(table)
    expect(lines).toHaveLength(rows.length + 1)
    expect(lines[0]).toBe('| x       |      |')
    expect(lines[1]).toBe('| ------- | ---- |')
    expect(lines.at(-1)).toBe('| longest | last |')
    expect(addRow(table, { row: 0, col: 0 }).table.rows[1]).toEqual(['', ''])
  })

  it('lays tables out as Format does', async () => {
    const lines = formatTable(
      parseTable(['|a|b|c|', '|:-|:-:|-:|', '|one|two|three|', '|x||y|']),
    )
    const text = `${lines.join('\n')}\n`
    expect((await formatMarkdown(text)).text).toBe(text)
  })
})

describe('where things are in a row', () => {
  it('finds the column around a position', () => {
    expect(columnAt(TABLE[2], 0)).toBe(0)
    expect(columnAt(TABLE[2], 3)).toBe(0)
    expect(columnAt(TABLE[2], 12)).toBe(1)
    expect(columnAt(TABLE[2], TABLE[2].length)).toBe(1)
  })

  it('finds the text of a cell, and past the pipe when empty', () => {
    expect(cellText(TABLE[2], 1)).toEqual({ from: 10, to: 13 })
    expect(cellText('|     |   |', 1)).toEqual({ from: 8, to: 8 })
  })
})

describe('aligning while typing', () => {
  const typed = (line: string) => {
    const ch = line.indexOf('^')
    const lines = [...TABLE]
    lines[2] = line.replace('^', '')
    return realign(lines, 2, ch)
  }

  it('widens the column around a longer cell', () => {
    expect(typed('| Ada Lovelace^   | Eng     |')).toEqual({
      lines: [
        '| Name         | Role    |',
        '| ------------ | ------- |',
        '| Ada Lovelace | Eng     |',
        '| Grace        | Admiral |',
      ],
      ch: 14,
    })
  })

  it('keeps the space just typed', () => {
    const next = typed('| New ^  | Eng     |')
    expect(next?.lines[2]).toBe('| New   | Eng     |')
    expect(next?.ch).toBe(6)
  })

  it('narrows again once the text is deleted', () => {
    const lines = ['| Name |', '| ---- |', '| abcd      |']
    expect(realign(lines, 2, 6)?.lines).toEqual([
      '| Name |',
      '| ---- |',
      '| abcd |',
    ])
  })

  it('keeps the caret in the text of a right-aligned cell', () => {
    const next = realign(['| a |', '| --: |', '|   12 |'], 2, 6)
    expect(next).toEqual({
      lines: ['|   a |', '| --: |', '|  12 |'],
      ch: 5,
    })
  })

  it('stays out of the way on the rule and when rows disagree', () => {
    expect(realign(TABLE, 1, 3)).toBeNull()
    const pipe = [...TABLE]
    pipe[2] = '| Ada | x | Eng |'
    expect(realign(pipe, 2, 7)).toBeNull()
  })

  it('stays out of the way past the last pipe', () => {
    expect(realign(TABLE, 2, TABLE[2].length)).toBeNull()
  })
})

describe('starting a table from its header', () => {
  it('adds a blank row', () => {
    expect(tableFromHeader('| Name | Role |')).toEqual({
      prefix: '',
      aligns: [null, null],
      rows: [
        ['Name', 'Role'],
        ['', ''],
      ],
    })
  })

  it('keeps the prefix', () => {
    expect(tableFromHeader('> | a |  ')?.prefix).toBe('> ')
  })

  it.each(['plain text', '| open', 'open |', '|', '||', '|  |', '| a \\|'])(
    'ignores %s',
    (line) => {
      expect(tableFromHeader(line)).toBeNull()
    },
  )
})

describe('editing a table', () => {
  const table = parseTable(TABLE)

  it('makes a blank table', () => {
    expect(formatTable(emptyTable('', 2, 2))).toEqual([
      '|     |     |',
      '| --- | --- |',
      '|     |     |',
    ])
  })

  it('adds a row below, and under the header from the header', () => {
    const below = addRow(table, { row: 1, col: 1 })
    expect(below.table.rows.map((row) => row[0])).toEqual([
      'Name',
      'Ada',
      '',
      'Grace',
    ])
    expect(below.cell).toEqual({ row: 2, col: 0 })
    expect(addRow(table, { row: 0, col: 1 }).table.rows[1][0]).toBe('')
  })

  it('adds a column to the right', () => {
    const edit = addColumn(table, { row: 1, col: 0 })
    expect(edit.table.rows[0]).toEqual(['Name', '', 'Role'])
    expect(edit.table.aligns).toEqual([null, null, null])
    expect(edit.cell).toEqual({ row: 1, col: 1 })
  })

  it('removes a row, but not the header', () => {
    expect(removeRow(table, { row: 1, col: 0 }).table.rows).toHaveLength(2)
    expect(removeRow(table, { row: 2, col: 1 }).cell).toEqual({
      row: 1,
      col: 1,
    })
    expect(removeRow(table, { row: 0, col: 0 }).table).toBe(table)
  })

  it('removes a column, but not the only one', () => {
    const edit = removeColumn(table, { row: 1, col: 1 })
    expect(edit.table.rows[0]).toEqual(['Name'])
    expect(edit.cell).toEqual({ row: 1, col: 0 })
    expect(removeColumn(edit.table, { row: 1, col: 0 }).table).toBe(edit.table)
  })

  it('aligns a column', () => {
    const { table: next } = alignColumn(table, { row: 0, col: 1 }, 'right')
    expect(next.aligns).toEqual([null, 'right'])
    expect(formatTable(next)[1]).toBe('| ----- | ------: |')
  })
})
