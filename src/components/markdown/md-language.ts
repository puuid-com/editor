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
import { tags as t } from '@lezer/highlight'
import { parseCode } from '@lezer/markdown'
import type { MarkdownParser } from '@lezer/markdown'
import type { Parser } from '@lezer/common'

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

const language = new Language(
  markdownLanguage.data,
  (markdownLanguage.parser as MarkdownParser).configure(
    parseCode({
      codeParser: (info) => CODE[info.trim().toLowerCase()] ?? null,
    }),
  ),
  [],
  'markdown',
)

// Greyscale like the rest of the editor: structure reads by weight, and the
// markup (`#`, `*`, `>`, fences) steps back to the meta colour.
const style = HighlightStyle.define(
  [
    { tag: t.heading, color: 'var(--syntax-tag)', fontWeight: '600' },
    { tag: t.strong, fontWeight: '600' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: [t.link, t.monospace, t.quote], color: 'var(--syntax-leaf)' },
    { tag: t.url, color: 'var(--syntax-attr)' },
    {
      tag: [t.processingInstruction, t.contentSeparator, t.labelName],
      color: 'var(--syntax-meta)',
    },
  ],
  { scope: language },
)

export function markdownSupport() {
  return new LanguageSupport(language, [
    syntaxHighlighting(style),
    // Enter continues a list or quote; Backspace removes its marker.
    Prec.high(keymap.of(markdownKeymap)),
    pasteURLAsLink,
  ])
}
