// Reads what each SQL token is from where it stands, so tables, aliases and
// columns can be told apart, which the grammar alone can't do. Colours follow
// the usual SQL editor convention (SSMS, Azure Data Studio): blue keywords,
// red strings, green comments, magenta functions, grey operators.

export type SqlTokenType =
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'identifier'
  | 'string'
  | 'number'
  | 'literal'
  | 'comment'
  | 'operator'
  | 'punct'

export interface SqlToken {
  type: SqlTokenType
  text: string
  from: number
  to: number
}

export type SqlRole =
  | 'keyword'
  | 'function'
  | 'string'
  | 'number'
  | 'literal'
  | 'comment'
  | 'operator'
  | 'table'
  | 'alias'
  | 'column'

export interface SqlMark {
  from: number
  to: number
  role: SqlRole
}

/** Keywords followed by a table name. */
const BEFORE_TABLE = new Set([
  'FROM',
  'JOIN',
  'INTO',
  'UPDATE',
  'TABLE',
  'APPLY',
])

/** Keywords that can come between `FROM`, `TABLE` and the like and the name. */
const BEFORE_NAME = new Set([
  'EXISTS',
  'IF',
  'LATERAL',
  'NOT',
  'ONLY',
  'RECURSIVE',
  'SELECT',
  'TABLE',
  'TEMP',
  'TEMPORARY',
  'UNNEST',
  'VALUES',
])

/** Clauses whose commas separate table names. */
const TABLE_LISTS = new Set(['FROM', 'WITH'])

/** Clause keywords, tracked per bracket level. */
const CLAUSES = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP',
  'HAVING',
  'ORDER',
  'LIMIT',
  'WITH',
  'JOIN',
  'ON',
  'SET',
  'VALUES',
  'INTO',
  'UPDATE',
  'RETURNING',
])

/** Keywords that stay keywords before `(`; any other one reads as a call. */
const NOT_CALLS = new Set([
  'ALL',
  'AND',
  'ANY',
  'AS',
  'EXISTS',
  'FROM',
  'IN',
  'INTO',
  'JOIN',
  'NOT',
  'ON',
  'OR',
  'OVER',
  'SELECT',
  'SOME',
  'TABLE',
  'USING',
  'VALUES',
  'WHERE',
  'WITH',
])

const name = (t: SqlToken) => t.text.replace(/^["`[]|["`\]]$/g, '')

export function classifySql(tokens: ReadonlyArray<SqlToken>): Array<SqlMark> {
  const marks: Array<SqlMark> = []
  const code = tokens.filter((t) => t.type !== 'comment').map((t) => ({ ...t }))
  const tables = new Set<string>()
  const aliases = new Set<string>()
  // Qualifiers are coloured once every table and alias is known.
  const qualifiers: Array<SqlToken> = []
  const clauses: Array<string | null> = [null]

  let tableNext = false
  let aliasNext = false

  const mark = (t: SqlToken, role: SqlRole) =>
    marks.push({ from: t.from, to: t.to, role })

  for (const t of tokens) {
    if (t.type === 'comment') mark(t, 'comment')
  }

  for (let i = 0; i < code.length; i++) {
    let t = code[i]
    const next = code.at(i + 1)
    const call = next?.text === '(' && next.from === t.to
    const upper = t.text.toUpperCase()
    // Tables are often named like keywords: `FROM user`, `INTO out`.
    if (tableNext && t.type === 'keyword' && !call && !BEFORE_NAME.has(upper))
      t = code[i] = { ...t, type: 'identifier' }

    switch (t.type) {
      case 'keyword':
      case 'type':
      case 'builtin': {
        if (t.type === 'builtin' || (call && !NOT_CALLS.has(upper))) {
          mark(t, 'function')
          aliasNext = false
          break
        }
        mark(t, 'keyword')
        if (CLAUSES.has(upper)) clauses[clauses.length - 1] = upper
        tableNext =
          BEFORE_TABLE.has(upper) ||
          upper === 'WITH' ||
          (upper === 'RECURSIVE' && tableNext)
        // `AS` keeps waiting for the alias it introduces.
        aliasNext = upper === 'AS'
        break
      }
      case 'identifier': {
        if (next?.text === '(' && !tableNext) {
          mark(t, 'function')
          aliasNext = false
          break
        }
        // A dotted chain: every part but the last qualifies the next.
        let end = i
        while (
          code[end + 1]?.text === '.' &&
          code[end + 2]?.type === 'identifier'
        )
          end += 2
        // `t.*`: the last part qualifies a star.
        const qualified = code[end + 1]?.text === '.'
        if (tableNext) {
          for (let k = i; k <= end; k += 2) mark(code[k], 'table')
          tables.add(name(code[end]).toLowerCase())
          tableNext = false
          aliasNext = true
        } else if (aliasNext) {
          mark(t, 'alias')
          aliases.add(name(t).toLowerCase())
          aliasNext = false
        } else {
          for (let k = i; k < end; k += 2) qualifiers.push(code[k])
          if (qualified) qualifiers.push(code[end])
          else mark(code[end], 'column')
          aliasNext = !qualified
        }
        i = end
        break
      }
      case 'string':
      case 'number':
      case 'literal':
        mark(t, t.type)
        tableNext = false
        aliasNext = t.type !== 'literal'
        break
      case 'punct':
      case 'operator': {
        mark(t, 'operator')
        if (t.text === '(') {
          clauses.push(null)
        } else if (t.text === ')') {
          if (clauses.length > 1) clauses.pop()
        }
        const clause = clauses[clauses.length - 1]
        tableNext = t.text === ',' && clause !== null && TABLE_LISTS.has(clause)
        // A closed bracket can be named: `(SELECT …) AS t`, `count(*) n`.
        aliasNext = t.text === ')'
        if (t.text === ';') clauses.splice(0, clauses.length, null)
        break
      }
    }
  }

  for (const q of qualifiers) {
    const key = name(q).toLowerCase()
    mark(q, tables.has(key) && !aliases.has(key) ? 'table' : 'alias')
  }
  return marks.sort((a, b) => a.from - b.from)
}
