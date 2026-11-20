import type { CSSProperties, ReactNode } from 'react'

import type { Line } from './kit'

const SQL_KEYWORDS = new Set(
  'SELECT FROM JOIN INNER LEFT ON WHERE AND OR AS ORDER BY DESC ASC GROUP LIMIT'.split(
    ' ',
  ),
)

/**
 * A small SQL colourer. `roles` reads tables, aliases, functions and columns
 * from where they stand, like the editor since 0.162.0; `grey` is the
 * greyscale palette SQL files had before it.
 */
export function sql(source: string, palette: 'roles' | 'grey'): Line[] {
  const tokens = [
    ...source.matchAll(
      /(--.*)|('[^']*')|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([ \t]+)|([=<>*]+)|(\n)|(.)/g,
    ),
  ]
  const words = tokens.map((t) => (t[4] ? t[4].toUpperCase() : ''))
  const aliases = new Set<string>()
  words.forEach((word, i) => {
    if (word !== 'FROM' && word !== 'JOIN') return
    const next = tokens.slice(i + 1).filter((t) => !t[5] && !t[7])
    const alias =
      next.at(1)?.[4]?.toUpperCase() === 'AS' ? next.at(2) : next.at(1)
    if (alias?.[4] && !SQL_KEYWORDS.has(alias[4].toUpperCase()))
      aliases.add(alias[4])
  })
  let expectTable = false
  const lines: ReactNode[][] = [[]]
  tokens.forEach((t, i) => {
    const [token] = t
    const line = lines[lines.length - 1]
    if (t[7]) {
      lines.push([])
      return
    }
    if (t[5]) {
      line.push(token)
      return
    }
    let role = 'punct'
    if (t[1]) role = 'comment'
    else if (t[2]) role = 'string'
    else if (t[3]) role = 'number'
    else if (t[6]) role = 'operator'
    else if (t[4]) {
      if (SQL_KEYWORDS.has(words[i])) role = 'keyword'
      else if (tokens[i + 1]?.[0] === '(') role = 'function'
      else if (expectTable) role = 'table'
      else if (aliases.has(token)) role = 'alias'
      else role = 'column'
      expectTable = words[i] === 'FROM' || words[i] === 'JOIN'
    }
    line.push(
      <span
        key={t.index}
        style={palette === 'roles' ? roleStyle(role) : grey(role)}
      >
        {token}
      </span>,
    )
  })
  return lines
}

function roleStyle(role: string): CSSProperties {
  if (role === 'punct') return { color: 'var(--sql-operator)' }
  return {
    color: `var(--sql-${role})`,
    fontStyle: role === 'comment' ? 'italic' : undefined,
    fontWeight: role === 'table' ? 500 : undefined,
  }
}

function grey(role: string): CSSProperties {
  if (role === 'keyword') return { color: 'var(--syntax-tag)', fontWeight: 500 }
  if (role === 'comment')
    return { color: 'var(--syntax-comment)', fontStyle: 'italic' }
  if (role === 'string' || role === 'number')
    return { color: 'var(--syntax-attr)' }
  if (role === 'operator' || role === 'punct')
    return { color: 'var(--syntax-punct)' }
  return { color: 'var(--syntax-value)' }
}
