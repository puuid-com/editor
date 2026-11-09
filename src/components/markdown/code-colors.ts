import type { MarkdownExtension } from '@tanstack/markdown'
import type { CSSProperties } from 'react'

import { highlightCss } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'

// Inline code takes a colour as HTML: `<code style="color: red">x</code>`.
// Apps that render HTML, like Obsidian and VS Code, show the colour too;
// GitHub shows plain code. Code in backticks stays blue.

export const CODE_TAG = 'md-code'

/** What each preset writes: a CSS name every app reads. */
const CSS_COLOR: Record<HighlightPreset, string> = {
  blue: 'blue',
  purple: 'purple',
  pink: 'deeppink',
  red: 'red',
  amber: 'orange',
  green: 'green',
  teal: 'teal',
  gray: 'gray',
}

/** CSS colours read as a preset, so they follow the theme here. */
const PRESET: Record<string, HighlightPreset> = {
  blue: 'blue',
  purple: 'purple',
  pink: 'pink',
  hotpink: 'pink',
  deeppink: 'pink',
  red: 'red',
  amber: 'amber',
  orange: 'amber',
  green: 'green',
  teal: 'teal',
  gray: 'gray',
  grey: 'gray',
}

/** A colour by name, hex or function, with nothing that could leave the value. */
const PLAIN_COLOR = /^(?:#[\da-f]{3,8}|[a-z]+|[a-z]+\([\d\s.,%/a-z+-]*\))$/

/** The colour a CSS value gives code here: a preset, or the value itself. */
export function readCodeColor(value: string): string | undefined {
  const css = value.trim().toLowerCase()
  return PRESET[css] ?? (PLAIN_COLOR.test(css) ? css : undefined)
}

/** Code's colour for the `md-code-color` class: its ink and wash, in styles.css. */
export function codeColorStyle(color: string) {
  return { '--md-code': highlightCss(color) } as CSSProperties
}

/* ---------------- Reading and writing ---------------- */

const OPEN = /^<code(?=[\s>])[^<>]*>/i
const CLOSE = /<\/code\s*>/i
const STYLE = /\sstyle\s*=\s*(["'])(.*?)\1/is
const COLOR_DECL = /(^|;)\s*color\s*:\s*([^;]*)/i
const PUNCTUATION = '!-/:-@[-`{-~'

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntity(name: string) {
  if (name[0] !== '#') return ENTITIES[name]
  const hex = name[1] === 'x' || name[1] === 'X'
  const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : undefined
}

const DECODE = new RegExp(
  `\\\\([${PUNCTUATION}])|&(#\\d+|#x[\\da-f]+|[a-z]+);|\\r?\\n`,
  'gi',
)

/** What HTML code shows: escapes and entities read as Markdown does, lines joined. */
function decodeText(raw: string) {
  return raw.replace(
    DECODE,
    (match, escaped?: string, entity?: string) =>
      escaped ?? (entity ? (decodeEntity(entity) ?? match) : ' '),
  )
}

const ESCAPE_BACKSLASH = new RegExp(`\\\\(?=[${PUNCTUATION}]|$)`, 'g')

/** Text as HTML code's content, read back the same here and elsewhere. */
function encodeText(text: string, inTable: boolean) {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Before punctuation, or `</code>` at the end, a backslash would escape it.
    .replace(ESCAPE_BACKSLASH, '\\\\')
  return inTable ? html.replace(/\|/g, '\\|') : html
}

export interface HtmlCode {
  /** Where the code's text starts and ends, after the opening tag. */
  textFrom: number
  textTo: number
  length: number
  text: string
  color?: string
}

/** `<code …>…</code>` at the start of `source`. */
export function readHtmlCode(source: string): HtmlCode | undefined {
  const open = OPEN.exec(source)
  if (!open) return undefined
  const textFrom = open[0].length
  const close = CLOSE.exec(source.slice(textFrom))
  if (!close) return undefined
  const textTo = textFrom + close.index
  const style = STYLE.exec(open[0])
  const decl = style && COLOR_DECL.exec(style[2])
  return {
    textFrom,
    textTo,
    length: textTo + close[0].length,
    text: decodeText(source.slice(textFrom, textTo)),
    color: decl ? readCodeColor(decl[2]) : undefined,
  }
}

/** Code written out, and where its text starts and ends in it. */
export interface WrittenCode {
  source: string
  textFrom: number
  textTo: number
}

const written = (open: string, body: string, close: string): WrittenCode => ({
  source: open + body + close,
  textFrom: open.length,
  textTo: open.length + body.length,
})

/** `text` as code in `color`. */
export function htmlCode(
  text: string,
  color: HighlightPreset,
  inTable = false,
) {
  const open = `<code style="color: ${CSS_COLOR[color]}">`
  return written(open, encodeText(text, inTable), '</code>')
}

/** The opening tag in `color`; its other attributes and styles stay. */
export function withColor(openTag: string, color: HighlightPreset) {
  const css = CSS_COLOR[color]
  const style = STYLE.exec(openTag)
  if (!style)
    return openTag.replace(/^<code/i, (tag) => `${tag} style="color: ${css}"`)
  const [, quote, value] = style
  const decls = value.trim()
  const next = COLOR_DECL.test(decls)
    ? decls.replace(
        COLOR_DECL,
        (_, start: string) => `${start}${start && ' '}color: ${css}`,
      )
    : [`color: ${css}`, decls].filter(Boolean).join('; ')
  return (
    openTag.slice(0, style.index) +
    ` style=${quote}${next}${quote}` +
    openTag.slice(style.index + style[0].length)
  )
}

/** What a code span shows, from the text between its backticks. */
export function codeSpanText(raw: string, inTable = false) {
  const text = (inTable ? raw.replace(/\\\|/g, '|') : raw).replace(
    /\r?\n/g,
    ' ',
  )
  return /^ .* $/s.test(text) && text.trim() ? text.slice(1, -1) : text
}

/** `text` as a code span, fenced past its own backticks. */
export function codeSpan(text: string, inTable = false) {
  const runs = text.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(0, ...runs.map((run) => run.length)) + 1)
  // Kept spaces, or a backtick at an end, need a space inside the fence.
  const pad =
    /^`|`$/.test(text) || (/^ .* $/s.test(text) && text.trim()) ? ' ' : ''
  const body = inTable ? text.replace(/\|/g, '\\|') : text
  return written(fence + pad, body, pad + fence)
}

/* ---------------- Preview ---------------- */

/** `<code>` read from text, as the editor reads it; other HTML stays text. */
export const htmlCodeSyntax: MarkdownExtension = {
  name: 'html-code',
  inlineParser: {
    markers: '<',
    parse: ({ source, index }) => {
      const code = readHtmlCode(source.slice(index))
      if (!code) return undefined
      const properties: Record<string, string> = code.color
        ? { color: code.color }
        : {}
      return {
        length: code.length,
        node: {
          type: 'inlineComponent',
          name: CODE_TAG,
          tagName: CODE_TAG,
          attributes: {},
          properties,
          children: [{ type: 'text', value: code.text }],
        },
      }
    },
  },
}
