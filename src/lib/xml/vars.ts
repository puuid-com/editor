import { m } from '#/paraglide/messages'

// Postman-style `<<name>>`, `{{name}}` and `${name}` placeholders. `<<name>>` is not
// valid XML (`<` is not allowed in text), so every parser works on a masked
// copy where the brackets are swapped for private-use characters. The masked
// text has the same length, so positions found in it map 1:1 back to the real
// document.

const VAR_OPEN = ''
const VAR_CLOSE = ''

/** Longest variable name accepted; keeps masking windows bounded. */
const VAR_MAX_NAME = 64
/** Longest argument list of a `$name(…)` call. */
const VAR_MAX_ARGS = 200
/** Longest possible `<<$name(…)>>`, `{{$name(…)}}` or `${$name$}` sequence. */
export const VAR_MAX_LENGTH = VAR_MAX_NAME + VAR_MAX_ARGS + 7

const IDENT = `[A-Za-z_][\\w.-]{0,${VAR_MAX_NAME - 1}}`
// A dynamic variable may take arguments, such as `{{$randomRegex([A-Z]{3})}}`.
// One level of nested parentheses is allowed. Functions the app doesn't know
// are still accepted and left as written.
const ARGS = `\\((?:[^()<>\\n]|\\([^()<>\\n]*\\)){0,${VAR_MAX_ARGS}}\\)`
// A leading `$` marks Postman's dynamic variables, such as `<<$randomInt>>`.
const NAME = `\\$${IDENT}(?:${ARGS})?|${IDENT}`
// `${…}` also takes a name wrapped in dollars, such as `${$stuff$}`.
const DOLLAR_NAME = `\\$${IDENT}\\$|${NAME}`

// The name is in group 1 for `<<name>>`, group 2 for `{{name}}` and group 3
// for `${name}`.
export const VAR_PATTERN = `<<\\s*(${NAME})\\s*>>|\\{\\{\\s*(${NAME})\\s*\\}\\}|\\$\\{\\s*(${DOLLAR_NAME})\\s*\\}`

export type VarStyle = 'angle' | 'curly' | 'dollar'

const BRACKETS: Record<VarStyle, readonly [string, string]> = {
  angle: ['<<', '>>'],
  curly: ['{{', '}}'],
  dollar: ['${', '}'],
}

/** `name` written as a variable in `style`. */
export function writeVar(name: string, style: VarStyle): string {
  const [open, close] = BRACKETS[style]
  return open + name + close
}

/** The bracket style of the first variable in `text`, if any. */
export function varStyleOf(text: string): VarStyle | undefined {
  const [, angle, curly, dollar] = varRegExp().exec(text) ?? []
  if (angle) return 'angle'
  if (curly) return 'curly'
  if (dollar) return 'dollar'
  return undefined
}

/**
 * How many variables `text` has, and the bracket style they share: null when
 * there are none or they mix styles.
 */
export function varStyles(text: string): {
  count: number
  style: VarStyle | null
} {
  const found = new Set<VarStyle>()
  let count = 0
  for (const [, angle, curly] of text.matchAll(varRegExp())) {
    found.add(angle ? 'angle' : curly ? 'curly' : 'dollar')
    count++
  }
  return { count, style: found.size === 1 ? [...found][0] : null }
}

export function varRegExp() {
  return new RegExp(VAR_PATTERN, 'g')
}

/** The variable name in a match of `varRegExp()`. */
export function varName(match: RegExpMatchArray): string {
  const [, angle, curly, dollar] = match as Array<string | undefined>
  return (angle ?? curly ?? dollar)!
}

/** `<< name >>` as `<<name>>`, keeping the brackets it was written with. */
export function trimVar(whole: string): string {
  const close = whole.endsWith('}}') || whole.endsWith('>>') ? 2 : 1
  return whole.slice(0, 2) + whole.slice(2, -close).trim() + whole.slice(-close)
}

/**
 * Rewrites every variable in `style`, such as `{{host}}` as `<<host>>`.
 * Returns the new text and how many variables changed. `${$name$}` only
 * exists in the `${…}` style, so it stays as written.
 */
export function convertVars(
  text: string,
  style: VarStyle,
): { text: string; count: number } {
  let count = 0
  const converted = text.replace(varRegExp(), (...args) => {
    const whole: string = args[0]
    const name = varName(args as RegExpMatchArray)
    if (name.endsWith('$') && style !== 'dollar') return whole
    const next = writeVar(name, style)
    if (next !== whole) count++
    return next
  })
  return { text: converted, count }
}

function hasVarOpen(text: string) {
  return text.includes('<<') || text.includes('{{') || text.includes('${')
}

export interface VarMatch {
  name: string
  from: number
  to: number
}

export function findVars(text: string): Array<VarMatch> {
  const found: Array<VarMatch> = []
  for (const match of text.matchAll(varRegExp())) {
    found.push({
      name: varName(match),
      from: match.index,
      to: match.index + match[0].length,
    })
  }
  return found
}

export function maskVars(text: string): string {
  if (!text.includes('<<')) return text
  // `{{name}}` is already valid XML.
  return text.replace(varRegExp(), (whole) =>
    whole.startsWith('<')
      ? VAR_OPEN + VAR_OPEN + whole.slice(2, -2) + VAR_CLOSE + VAR_CLOSE
      : whole,
  )
}

/**
 * For the JSON grammar: each variable becomes a same-length number, so a bare
 * `<<qty>>` or `{{qty}}` value parses and one inside a string stays part of it.
 */
export function maskVarsAsNumbers(text: string): string {
  if (!hasVarOpen(text)) return text
  return text.replace(varRegExp(), (whole) => '1'.padEnd(whole.length, '0'))
}

// Bracket characters that may not touch a variable written in each style.
const ANGLE = new Set(['<', '>'])
const CURLY = new Set(['{', '}'])
const STRAY: Record<
  VarStyle,
  readonly [ReadonlySet<string>, ReadonlySet<string>]
> = {
  angle: [ANGLE, ANGLE],
  curly: [CURLY, CURLY],
  dollar: [new Set(['$']), new Set(['}'])],
}

const LEFTOVER = /<<|>>|\{\{|\}\}|\$\{/g
// Its own instance: `wellFormed` moves `lastIndex` while `LEFTOVER` iterates.
const ANY_LEFTOVER = new RegExp(LEFTOVER.source, 'g')

/** Whether `text` has a bracket pair between `from` and `to`. */
function hasLeftover(text: string, from: number, to: number) {
  if (to - from < 2) return false
  ANY_LEFTOVER.lastIndex = from
  const match = ANY_LEFTOVER.exec(text)
  return !!match && match.index + match[0].length <= to
}

/**
 * The common case, checked without copying the text: every variable is well
 * formed, none touches a stray bracket and no bracket pair is left over.
 * False means "maybe not", for the full check to decide.
 */
function wellFormed(text: string, vars: Array<RegExpExecArray>) {
  let last = 0
  for (const match of vars) {
    const from = match.index
    const to = from + match[0].length
    const [before, after] =
      STRAY[match[1] ? 'angle' : match[2] ? 'curly' : 'dollar']
    if (from > 0 && before.has(text[from - 1])) return false
    if (to < text.length && after.has(text[to])) return false
    if (hasLeftover(text, last, from)) return false
    last = to
  }
  return !hasLeftover(text, last, text.length)
}

const CLOSER: Record<string, string | undefined> = {
  '<<': '>>',
  '{{': '}}',
  '${': '}',
}

/**
 * Malformed variables in a run of text, such as `{{{name}}}`, `<<<name>>`,
 * `{{ bad name }}` or an unclosed `${name`. Only `<<name>>`, `{{name}}` and
 * `${name}` are accepted. Positions are offset by `offset`.
 */
export function findVarProblems(
  text: string,
  offset = 0,
): Array<{ from: number; to: number; message: string }> {
  if (!/[<>{}$]/.test(text)) return []
  const vars = [...text.matchAll(varRegExp())]
  if (wellFormed(text, vars)) return []
  const problems: Array<{ from: number; to: number; message: string }> = []
  const report = (from: number, to: number) =>
    problems.push({
      from: from + offset,
      to: to + offset,
      message: m.parse_invalid_variable({ text: text.slice(from, to) }),
    })
  // Mutate code units in place: rebuilding the whole string for each variable
  // makes validation quadratic on documents with many placeholders.
  const rest = text.split('')
  for (const match of vars) {
    const from = match.index
    const to = from + match[0].length
    rest.fill('\0', from, to)
  }
  for (const match of vars) {
    const from = match.index
    const to = from + match[0].length
    const [before, after] =
      STRAY[match[1] ? 'angle' : match[2] ? 'curly' : 'dollar']
    let start = from
    let end = to
    while (start > 0 && before.has(rest[start - 1])) start--
    while (end < text.length && after.has(rest[end])) end++
    if (start < from || end > to) {
      rest.fill('\0', start, end)
      report(start, end)
    }
  }
  for (const match of rest.join('').matchAll(LEFTOVER)) {
    const from = match.index
    if (rest[from] === '\0') continue
    const closer = CLOSER[match[0]]
    let to = from + match[0].length
    if (closer) {
      // Takes in the rest of the variable when it is closed on the same line.
      const window = rest.slice(to, to + VAR_MAX_LENGTH * 2).join('')
      const close = window.search(/\n/)
      const at = window.indexOf(closer)
      if (at >= 0 && (close < 0 || at < close)) to += at + closer.length
    }
    rest.fill('\0', from, to)
    report(from, to)
  }
  return problems.sort((a, b) => a.from - b.from)
}

/** Splits text into literal and variable parts, in order. */
export function splitVars(
  text: string,
): Array<{ kind: 'text' | 'var'; value: string }> {
  const parts: Array<{ kind: 'text' | 'var'; value: string }> = []
  let last = 0
  for (const match of findVars(text)) {
    if (match.from > last) {
      parts.push({ kind: 'text', value: text.slice(last, match.from) })
    }
    parts.push({ kind: 'var', value: text.slice(match.from, match.to) })
    last = match.to
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
