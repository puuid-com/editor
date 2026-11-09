import { jsonLanguage } from '@codemirror/lang-json'
import {
  markdownKeymap,
  markdownLanguage,
  pasteURLAsLink,
} from '@codemirror/lang-markdown'
import { StandardSQL } from '@codemirror/lang-sql'
import { xmlLanguage } from '@codemirror/lang-xml'
import {
  HighlightStyle,
  Language,
  LanguageSupport,
  syntaxHighlighting,
} from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { Tag, styleTags, tags as t } from '@lezer/highlight'
import { parseCode } from '@lezer/markdown'
import type { MarkdownConfig, MarkdownParser } from '@lezer/markdown'
import type { Parser } from '@lezer/common'

import { codeBlocks } from './md-code'
import {
  codeColorCompletion,
  codeColorStyles,
  codeColorSyntax,
} from './md-code-colors'
import { quoteLines } from './md-quotes'
import { markdownTables, tableKeymap } from './md-table'

// Built from the GFM grammar directly rather than through `markdown()`, which
// would pull in the HTML, CSS and JavaScript grammars for embedded HTML.

/** Fenced code in the languages the editor already reads keeps its colours. */
const CODE: Record<string, Parser> = {
  xml: xmlLanguage.parser,
  html: xmlLanguage.parser,
  svg: xmlLanguage.parser,
  json: jsonLanguage.parser,
  sql: StandardSQL.language.parser,
}

/** Inline code, apart from fenced code, which shares `monospace`. */
const inlineCode = Tag.define(t.monospace)
const highlight = Tag.define()
const wikilink = Tag.define(t.link)

const HighlightDelim = { resolve: 'Highlight', mark: 'HighlightMark' }
const SingleTildeDelim = { resolve: 'Strikethrough', mark: 'StrikethroughMark' }

/** `~struck~`, which the preview reads as well as GFM's `~~struck~~`. */
const singleTilde: MarkdownConfig = {
  parseInline: [
    {
      name: 'SingleTilde',
      parse(cx, next, pos) {
        if (
          next !== 126 ||
          cx.char(pos + 1) === 126 ||
          cx.char(pos - 1) === 126
        )
          return -1
        const before = cx.slice(pos - 1, pos)
        const after = cx.slice(pos + 1, pos + 2)
        // Like the preview, so `~5` and `a ~ b` stay plain.
        return cx.addDelimiter(
          SingleTildeDelim,
          pos,
          pos + 1,
          !/[\s\d]|^$/.test(after),
          !/\s|^$/.test(before),
        )
      },
      after: 'Emphasis',
    },
  ],
}

/** Obsidian's `==highlights==` and `[[links]]`, as the preview reads them. */
const obsidian: MarkdownConfig = {
  props: [styleTags({ InlineCode: inlineCode })],
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': highlight } },
    { name: 'HighlightMark', style: t.processingInstruction },
    { name: 'WikiLink', style: { 'WikiLink/...': wikilink } },
    { name: 'WikiLinkMark', style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        // `==`, but not `===`, like GFM's `~~`.
        if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61)
          return -1
        const before = cx.slice(pos - 1, pos)
        const after = cx.slice(pos + 2, pos + 3)
        return cx.addDelimiter(
          HighlightDelim,
          pos,
          pos + 2,
          !/\s|^$/.test(after),
          !/\s|^$/.test(before),
        )
      },
      after: 'Emphasis',
    },
    {
      name: 'WikiLink',
      parse(cx, next, pos) {
        const open = next === 33 ? pos + 1 : pos
        if (cx.char(open) !== 91 || cx.char(open + 1) !== 91) return -1
        const rest = cx.slice(open + 2, cx.end)
        const close = rest.indexOf(']]')
        if (close < 0) return -1
        const inner = rest.slice(0, close)
        if (!inner.trim() || /[\n[\]]/.test(inner)) return -1
        const end = open + 4 + close
        return cx.addElement(
          cx.elt('WikiLink', pos, end, [
            cx.elt('WikiLinkMark', pos, open + 2),
            cx.elt('WikiLinkMark', end - 2, end),
          ]),
        )
      },
      before: 'Link',
    },
  ],
}

const language = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure([
    parseCode({
      codeParser: (info) => CODE[info.trim().toLowerCase()] ?? null,
    }),
    obsidian,
    singleTilde,
    codeColorSyntax,
  ]),
  [],
  'markdown',
)

// The text reads as the preview shows it: headings sized, bold, italic,
// struck, highlighted and code text styled, links underlined. The markup
// (`#`, `*`, `>`, fences) stays visible and steps back to the meta colour.
const HEADING = { color: 'var(--foreground)', fontWeight: '600' }

const style = HighlightStyle.define(
  [
    // A tag takes only its most specific rule, so each level is complete.
    { tag: t.heading, ...HEADING },
    { tag: t.heading1, ...HEADING, fontSize: '1.5em' },
    { tag: t.heading2, ...HEADING, fontSize: '1.3em' },
    { tag: t.heading3, ...HEADING, fontSize: '1.15em' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.monospace, color: 'var(--muted-foreground)' },
    { tag: t.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },
    {
      tag: inlineCode,
      color: 'var(--sql-keyword)',
      backgroundColor: 'color-mix(in oklch, var(--hl-blue) 10%, transparent)',
    },
    ...codeColorStyles,
    {
      tag: highlight,
      backgroundColor: 'color-mix(in oklch, var(--hl-amber) 30%, transparent)',
    },
    {
      tag: t.link,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
    },
    { tag: t.url, color: 'var(--syntax-attr)' },
    // After the rules above, so marks inside a link or highlight stay plain.
    {
      tag: [t.processingInstruction, t.contentSeparator, t.labelName],
      color: 'var(--syntax-meta)',
      fontStyle: 'normal',
      textDecoration: 'none',
      backgroundColor: 'transparent',
    },
  ],
  { scope: language },
)

export function markdownSupport() {
  return new LanguageSupport(language, [
    syntaxHighlighting(style),
    quoteLines,
    codeBlocks(new Set(Object.keys(CODE))),
    markdownTables(language),
    language.data.of({ autocomplete: codeColorCompletion }),
    // Enter continues a list or quote; Backspace removes its marker.
    Prec.high(keymap.of([...tableKeymap, ...markdownKeymap])),
    pasteURLAsLink,
  ])
}
