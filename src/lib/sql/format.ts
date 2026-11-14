// A small SQL formatter: clauses start a line, list items and conditions
// continue on their own indented lines with the comma or AND/OR first,
// subqueries indent one level, and keywords are upper-cased. Everything else
// (identifiers, strings, function calls) is kept as written.

type TokenKind =
  'word' | 'string' | 'quoted' | 'number' | 'op' | 'line-comment' | 'comment'

interface Token {
  kind: TokenKind
  text: string
  /** Whitespace came right before it in the source. */
  spaced: boolean
}

const KEYWORDS = new Set(
  `ADD ALL ALTER AND ANY APPLY AS ASC BETWEEN BY CASE COLUMN CONSTRAINT CREATE
  CROSS DATABASE DELETE DESC DISTINCT DROP ELSE END ESCAPE EXCEPT EXISTS FOREIGN
  FROM FULL GROUP HAVING ILIKE IN INDEX INNER INSERT INTERSECT INTO IS JOIN LEFT
  LIKE LIMIT NOT NULL OFFSET ON OR ORDER OUTER OVER PARTITION PRIMARY QUALIFY
  RECURSIVE REFERENCES RETURNING RIGHT SELECT SET TABLE THEN TOP UNION UNIQUE
  UPDATE USING VALUES VIEW WHEN WHERE WITH`.split(/\s+/),
)

/** Keyword runs read as one clause keyword. */
const PHRASES = [
  ['LEFT', 'OUTER', 'JOIN'],
  ['RIGHT', 'OUTER', 'JOIN'],
  ['FULL', 'OUTER', 'JOIN'],
  ['INNER', 'JOIN'],
  ['LEFT', 'JOIN'],
  ['RIGHT', 'JOIN'],
  ['FULL', 'JOIN'],
  ['CROSS', 'JOIN'],
  ['CROSS', 'APPLY'],
  ['OUTER', 'APPLY'],
  ['GROUP', 'BY'],
  ['ORDER', 'BY'],
  ['PARTITION', 'BY'],
  ['UNION', 'ALL'],
  ['INSERT', 'INTO'],
  ['DELETE', 'FROM'],
  ['SELECT', 'DISTINCT'],
]

/** Clauses that start their own line. */
const CLAUSES = new Set([
  'SELECT',
  'SELECT DISTINCT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'QUALIFY',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'DELETE FROM',
  'RETURNING',
  'WITH',
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'CROSS JOIN',
  'CROSS APPLY',
  'OUTER APPLY',
])

/** Clauses whose top-level commas put each item on its own line. */
const LISTS = new Set([
  'SELECT',
  'SELECT DISTINCT',
  'FROM',
  'GROUP BY',
  'ORDER BY',
  'VALUES',
  'SET',
  'RETURNING',
])

/** Clauses whose top-level AND/OR put each condition on its own line. */
const CONDITIONS = new Set(['WHERE', 'HAVING', 'QUALIFY', 'ON'])

/** Set operators: the next query starts on a line of its own. */
const SET_OPS = new Set(['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'])

/** Keywords that keep a space before `(` even when written without one. */
const SPACE_BEFORE_PAREN = new Set([
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
  'TABLE',
  'USING',
  'VALUES',
  'WHERE',
])

const OPERATORS = [
  '->>',
  '<>',
  '!=',
  '<=',
  '>=',
  '::',
  '||',
  '->',
  '=>',
  '<<',
  '>>',
]

function tokenize(sql: string): Array<Token> {
  const tokens: Array<Token> = []
  let i = 0
  let spaced = false
  const push = (kind: TokenKind, end: number) => {
    tokens.push({ kind, text: sql.slice(i, end), spaced })
    i = end
    spaced = false
  }
  const until = (close: string, from: number) => {
    const at = sql.indexOf(close, from)
    return at < 0 ? sql.length : at + close.length
  }
  const quotedEnd = (close: string, from: number, escapes = false) => {
    for (let at = from; at < sql.length; at++) {
      if (escapes && sql[at] === '\\') at++
      else if (sql[at] === close) {
        if (sql[at + 1] === close) at++
        else return at + 1
      }
    }
    return sql.length
  }

  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1] ?? ''
    if (/\s/.test(ch)) {
      spaced = true
      i++
    } else if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i)
      push('line-comment', end < 0 ? sql.length : end)
      tokens[tokens.length - 1].text = tokens[tokens.length - 1].text.trimEnd()
    } else if (ch === '/' && next === '*') {
      push('comment', until('*/', i + 2))
    } else if (ch === "'" || (/[NEXB]/i.test(ch) && next === "'")) {
      push('string', quotedEnd("'", i + (ch === "'" ? 1 : 2), /e/i.test(ch)))
    } else if (ch === '"' || ch === '`') {
      push('quoted', quotedEnd(ch, i + 1))
    } else if (ch === '[') {
      push('quoted', quotedEnd(']', i + 1))
    } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(next))) {
      const match = /^(\d*\.?\d+|\d+\.)(e[+-]?\d+)?/i.exec(sql.slice(i))
      push('number', i + (match?.[0].length ?? 1))
    } else if (
      /[\w@#$]/.test(ch) ||
      ((ch === ':' || ch === '?') && /\w/.test(next))
    ) {
      const match = /^[:?]?[\w@#$]+/.exec(sql.slice(i))
      push('word', i + (match?.[0].length ?? 1))
    } else {
      const op = OPERATORS.find((o) => sql.startsWith(o, i))
      push('op', i + (op?.length ?? 1))
    }
  }
  return tokens
}

/** A word read as a keyword: not qualified (`t.end`) and not a call (`left(`). */
function keywordAt(tokens: ReadonlyArray<Token>, i: number) {
  const token = tokens[i]
  if (token.kind !== 'word') return null
  const upper = token.text.toUpperCase()
  if (!KEYWORDS.has(upper)) return null
  const prev = tokens[i - 1] as Token | undefined
  const next = tokens[i + 1] as Token | undefined
  if (prev?.text === '.' || next?.text === '.') return null
  if (next?.text === '(' && !next.spaced && !SPACE_BEFORE_PAREN.has(upper))
    return null
  return upper
}

interface Frame {
  /** Parenthesised query: its clauses get their own lines. */
  query: boolean
  /** Indent of the frame's clause lines. */
  base: number
  /** Indent of the line the frame opened on, where its `)` goes back to. */
  opener: number
  clause: string | null
  /** Open CASE expressions, inside which nothing breaks. */
  cases: number
  /** A BETWEEN waiting for its AND. */
  between: boolean
}

interface Line {
  indent: number
  text: string
}

export function formatSql(sql: string, indent = '\t'): string {
  const tokens = tokenize(sql)
  const lines: Array<Line> = [{ indent: 0, text: '' }]
  const top = (): Frame => frames[frames.length - 1]
  let frames: Array<Frame> = []
  const reset = () => {
    frames = [
      {
        query: true,
        base: 0,
        opener: 0,
        clause: null,
        cases: 0,
        between: false,
      },
    ]
  }
  reset()

  const line = () => lines[lines.length - 1]
  const newline = (level: number) => {
    if (line().text === '') line().indent = level
    else lines.push({ indent: level, text: '' })
  }
  let glue = false
  const write = (text: string, space: boolean) => {
    const current = line()
    if (current.text !== '' && space && !glue) current.text += ' '
    current.text += text
    glue = false
  }

  let prev: Token | null = null
  let prevKeyword: string | null = null
  let ended = false

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    let keyword = keywordAt(tokens, i)

    if (keyword) {
      for (const phrase of PHRASES) {
        const fits = phrase.every(
          (word, k) =>
            tokens[i + k]?.kind === 'word' &&
            tokens[i + k].text.toUpperCase() === word,
        )
        if (!fits) continue
        keyword = phrase.join(' ')
        token = { ...token, text: keyword }
        i += phrase.length - 1
        break
      }
    }

    if (ended) {
      lines.push({ indent: 0, text: '' }, { indent: 0, text: '' })
      reset()
      prev = null
      prevKeyword = null
      ended = false
    }

    const frame = top()
    const breaks = frame.query && frame.cases === 0
    const text = keyword ?? token.text

    if (token.kind === 'line-comment') {
      write(text, true)
      newline(frame.base + (frame.clause ? 1 : 0))
    } else if (keyword && CLAUSES.has(keyword) && breaks) {
      newline(frame.base)
      write(text, true)
      frame.clause = keyword
      if (SET_OPS.has(keyword)) newline(frame.base)
    } else if (keyword === 'ON' && breaks) {
      write(text, true)
      frame.clause = 'ON'
    } else if (
      (keyword === 'AND' || keyword === 'OR') &&
      breaks &&
      !frame.between &&
      frame.clause &&
      CONDITIONS.has(frame.clause)
    ) {
      newline(frame.base + 1)
      write(text, true)
    } else if (text === ',' && breaks && frame.clause === 'WITH') {
      newline(frame.base)
      write(text, true)
    } else if (
      text === ',' &&
      breaks &&
      frame.clause &&
      LISTS.has(frame.clause)
    ) {
      newline(frame.base + 1)
      write(text, true)
    } else if (text === '(') {
      const after = tokens[i + 1] as Token | undefined
      const query =
        after?.kind === 'word' && /^(select|with)$/i.test(after.text)
      const space =
        prev?.kind === 'word' && !prevKeyword
          ? token.spaced
          : prev?.text !== '('
      write(text, space)
      const opener = line().indent
      frames.push({
        query,
        base: query ? opener + 1 : opener,
        opener,
        clause: null,
        cases: 0,
        between: false,
      })
      glue = true
    } else if (text === ')') {
      const closed = frames.length > 1 ? frames.pop() : undefined
      if (closed?.query) newline(closed.opener)
      write(text, false)
    } else if (text === ';' && frames.length === 1) {
      write(text, false)
      ended = true
    } else {
      const unary =
        (text === '-' || text === '+') &&
        (prev === null ||
          prevKeyword !== null ||
          (prev.kind === 'op' && prev.text !== ')'))
      const space = !(
        text === ',' ||
        text === '.' ||
        text === '::' ||
        text === ';' ||
        prev?.text === '.' ||
        prev?.text === '::'
      )
      write(text, space)
      if (unary) glue = true
      if (keyword === 'CASE') frame.cases++
      if (keyword === 'END' && frame.cases > 0) frame.cases--
      if (keyword === 'BETWEEN') frame.between = true
      if (keyword === 'AND' && frame.between) frame.between = false
    }

    prev = token
    prevKeyword = keyword
  }

  return lines
    .map((l) => (l.text === '' ? '' : indent.repeat(l.indent) + l.text))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat(sql.endsWith('\n') ? '\n' : '')
}
