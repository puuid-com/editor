import { describe, expect, it } from 'vitest'

import { classifySql } from './highlight'
import type { SqlToken, SqlTokenType } from './highlight'

// Hand-built tokens, as the editor's grammar would give them. Brackets, dots
// and commas sit flush against their neighbours, as they're usually written.
function tokens(...parts: Array<[SqlTokenType, string]>): Array<SqlToken> {
  const list: Array<SqlToken> = []
  let at = 0
  for (const [type, text] of parts) {
    const prev = list.at(-1)?.text
    const flush =
      ['(', ')', '.', ','].includes(text) || prev === '.' || prev === '('
    if (list.length > 0 && !flush) at += 1
    list.push({ type, text, from: at, to: at + text.length })
    at += text.length
  }
  return list
}

function roles(list: Array<SqlToken>) {
  const marks = classifySql(list)
  return Object.fromEntries(
    marks
      .filter((m) => m.role !== 'operator' && m.role !== 'keyword')
      .map((m) => [list.find((t) => t.from === m.from)?.text, m.role]),
  )
}

describe('classifySql', () => {
  it('tells tables, aliases and columns apart', () => {
    expect(
      roles(
        tokens(
          ['keyword', 'SELECT'],
          ['identifier', 't1'],
          ['punct', '.'],
          ['identifier', 'col'],
          ['punct', ','],
          ['identifier', 'col2'],
          ['keyword', 'FROM'],
          ['identifier', 'table1'],
          ['keyword', 'AS'],
          ['identifier', 't1'],
          ['keyword', 'WHERE'],
          ['identifier', 'amount'],
          ['operator', '>'],
          ['number', '3'],
        ),
      ),
    ).toEqual({
      t1: 'alias',
      col: 'column',
      col2: 'column',
      table1: 'table',
      amount: 'column',
      3: 'number',
    })
  })

  it('reads calls as functions and keyword-named tables as tables', () => {
    expect(
      roles(
        tokens(
          ['keyword', 'SELECT'],
          ['keyword', 'count'],
          ['punct', '('],
          ['operator', '*'],
          ['punct', ')'],
          ['keyword', 'FROM'],
          ['keyword', 'user'],
          ['identifier', 'u'],
        ),
      ),
    ).toEqual({ count: 'function', user: 'table', u: 'alias' })
  })

  it('colours a qualifier by what it names', () => {
    expect(
      roles(
        tokens(
          ['keyword', 'SELECT'],
          ['identifier', 'orders'],
          ['punct', '.'],
          ['operator', '*'],
          ['keyword', 'FROM'],
          ['identifier', 'orders'],
        ),
      ),
    ).toEqual({ orders: 'table' })
  })

  it('marks comments and strings', () => {
    expect(
      roles(
        tokens(
          ['comment', '-- note'],
          ['keyword', 'SELECT'],
          ['string', "'x'"],
        ),
      ),
    ).toEqual({ '-- note': 'comment', "'x'": 'string' })
  })
})
