import { IconFileCode, IconPlus, IconX } from '@tabler/icons-react'
import type { CSSProperties, ReactNode } from 'react'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// Static, inert miniatures of the editor for the changelog. Each preview
// pictures what one release changed, as one shot or a before/after pair.
// They are illustrations: `inert` keeps their controls out of the tab order
// and the accessibility tree, since the bullets already say what changed.

export function Figure({ children }: { children: ReactNode }) {
  return (
    <figure inert className="not-prose mt-6 grid gap-3 select-none">
      {children}
    </figure>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  )
}

/** One framed picture, optionally labelled. */
export function Shot({
  label,
  className,
  children,
}: {
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-2',
        label ? 'grid-rows-[auto_1fr]' : 'content-start',
      )}
    >
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          'relative min-w-0 overflow-hidden border bg-background text-xs',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** The same spot before and after the release, side by side. */
export function BeforeAfter({
  before,
  after,
  className,
}: {
  before: ReactNode
  after: ReactNode
  className?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Shot label={m.changelog_before()} className={className}>
        {before}
      </Shot>
      <Shot label={m.changelog_after()} className={className}>
        {after}
      </Shot>
    </div>
  )
}

/* ---------------- Code ---------------- */

type SyntaxTone = 'tag' | 'leaf' | 'attr' | 'value' | 'punct' | 'comment'

export function Syn({ k, children }: { k: SyntaxTone; children: ReactNode }) {
  return <span style={{ color: `var(--syntax-${k})` }}>{children}</span>
}

export function VarChip({ children }: { children: ReactNode }) {
  return <span className="var-chip">{children}</span>
}

/** A `<<name>>` variable or plain text, as the editor shows text content. */
function text(value: string, key: number): ReactNode {
  return value.split(/(<<[\w$]+>>)/).map((part, i) =>
    /^<<[\w$]+>>$/.test(part) ? (
      <VarChip key={`${key}-${i}`}>{part}</VarChip>
    ) : (
      <Syn key={`${key}-${i}`} k="value">
        {part}
      </Syn>
    ),
  )
}

/** A one-line XML tokenizer coloured with the editor's syntax tokens. */
export function xml(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = line
  let inTag = false
  let named = false
  while (rest) {
    const match = inTag
      ? /^(\s+)|^(\/?>)|^(=)|^("[^"]*")|^([^\s=/>]+)/.exec(rest)
      : /^(<<[\w$]+>>)|^(<[/?]?)|^((?:[^<]|<<)+?(?=<[^<]|$))/.exec(rest)
    if (!match) break
    const [token] = match
    const key = out.length
    if (inTag) {
      if (match[1]) out.push(token)
      else if (match[2]) {
        out.push(
          <Syn key={key} k="punct">
            {token}
          </Syn>,
        )
        inTag = false
      } else if (match[3])
        out.push(
          <Syn key={key} k="punct">
            {token}
          </Syn>,
        )
      else if (match[4])
        out.push(
          <Syn key={key} k="value">
            {token}
          </Syn>,
        )
      else {
        out.push(
          <Syn key={key} k={named ? 'attr' : 'tag'}>
            {token}
          </Syn>,
        )
        named = true
      }
    } else if (match[1]) out.push(<VarChip key={key}>{token}</VarChip>)
    else if (match[2]) {
      out.push(
        <Syn key={key} k="punct">
          {token}
        </Syn>,
      )
      inTag = true
      named = false
    } else out.push(text(token, key))
    rest = rest.slice(token.length)
  }
  return out
}

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
      <span key={i} style={palette === 'roles' ? roleStyle(role) : grey(role)}>
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

export type Line = string | ReactNode
export type LineMark = 'add' | 'remove' | 'active'

const MARK: Record<LineMark, string> = {
  add: 'bg-(--hl-green)/12',
  remove: 'bg-(--hl-red)/12',
  active: 'bg-(--syntax-active-line)',
}

const mark = (kind?: LineMark) => kind && MARK[kind]

/** Editor lines with a gutter. Strings go through `format`, nodes as is. */
export function Code({
  lines,
  format = xml,
  marks = {},
  wrap = false,
  className,
}: {
  lines: Line[]
  format?: (line: string) => ReactNode
  marks?: Partial<Record<number, LineMark>>
  wrap?: boolean
  className?: string
}) {
  return (
    <pre
      className={cn(
        'overflow-hidden py-2 font-mono text-[11px] leading-5 [tab-size:2]',
        className,
      )}
    >
      {lines.map((line, i) => (
        <div key={i} className={cn('flex pr-3', mark(marks[i]))}>
          <span className="w-8 shrink-0 pr-3 text-right text-(--syntax-gutter)">
            {i + 1}
          </span>
          <span
            className={cn(
              'min-w-0',
              wrap ? 'wrap-break-word whitespace-pre-wrap' : 'whitespace-pre',
            )}
          >
            {typeof line === 'string' ? format(line) : line}
          </span>
        </div>
      ))}
    </pre>
  )
}

/* ---------------- Chrome ---------------- */

/** A tab strip: browser-style tabs on a muted band, as the editor has them. */
export function Tabs({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-8 items-end gap-px overflow-hidden border-b bg-muted/60 px-2 pt-1 text-xs">
      {children}
    </div>
  )
}

export function Tab({
  name,
  active,
  color,
  close = true,
}: {
  name: string
  active?: boolean
  /** A profile's highlight colour, which tints the name like the editor. */
  color?: string
  close?: boolean
}) {
  return (
    <div
      data-active={active || undefined}
      className={cn(
        'chrome-tab relative flex h-full shrink-0 items-center gap-1.5 rounded-t-lg pr-2 pl-3',
        active ? 'z-10 bg-background' : 'text-muted-foreground',
      )}
    >
      <IconFileCode className="size-3.5 shrink-0 text-muted-foreground" />
      {color ? (
        <span
          style={{ '--hl': color } as CSSProperties}
          className="hl-tag hl-ink truncate px-1 leading-5"
        >
          {name}
        </span>
      ) : (
        <span className="truncate">{name}</span>
      )}
      {close && <IconX className="size-3 shrink-0 text-muted-foreground" />}
    </div>
  )
}

export function NewTab({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center self-center text-muted-foreground',
        className,
      )}
    >
      <IconPlus className="size-3.5" />
    </div>
  )
}

/** The editor's bottom bar. */
export function StatusBar({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1 border-t px-1.5 text-[11px] whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A highlight chip as the bottom bar shows it. */
export function Chip({
  name,
  color,
  count,
  dim,
}: {
  name: string
  color: string
  count?: number
  dim?: boolean
}) {
  return (
    <span
      style={{ '--hl': color } as CSSProperties}
      className={cn(
        'hl-tag inline-flex h-5 items-center gap-1 px-1.5 font-mono text-[11px]',
        dim ? 'opacity-45' : 'hl-ink',
      )}
    >
      {name}
      {count !== undefined && (
        <span className="text-muted-foreground tabular-nums">{count}</span>
      )}
    </span>
  )
}

/** A neutral placeholder bar standing in for copy. */
export function Bar({ className }: { className?: string }) {
  return <span className={cn('block h-1.5 bg-muted', className)} />
}
