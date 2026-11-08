import { syntaxTree } from '@codemirror/language'
import { Prec, RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { HighlightToken } from '@tanstack/highlight/core'

import { treeChanged } from '#/components/editor/syntax'

import { highlighter } from './highlight'

const codeLine = Decoration.line({ class: 'cm-md-code' })
const firstLine = Decoration.line({ class: 'cm-md-code cm-md-code-first' })
const lastLine = Decoration.line({ class: 'cm-md-code cm-md-code-last' })
const onlyLine = Decoration.line({
  class: 'cm-md-code cm-md-code-first cm-md-code-last',
})
const marks = new Map<string, Decoration>()
const mark = (name: string) => {
  let decoration = marks.get(name)
  if (!decoration) {
    decoration = Decoration.mark({ class: `th-${name}` })
    marks.set(name, decoration)
  }
  return decoration
}

/**
 * The fence's language as the preview's highlighter knows it, or `null` when
 * it doesn't, or when the editor's own grammar already colours it.
 */
function fenceLanguage(info: string, nested: ReadonlySet<string>) {
  const word = info.trim().split(/\s/)[0]?.toLowerCase() ?? ''
  if (!word || nested.has(word)) return null
  const lang = highlighter.normalizeLanguage(word)
  return lang === 'plaintext' ? null : lang
}

/** Tokens of the last pass, so scrolling doesn't re-read unchanged blocks. */
let cache = new Map<string, Array<HighlightToken>>()

function decorations(view: EditorView, nested: ReadonlySet<string>) {
  const lines = new RangeSetBuilder<Decoration>()
  const tokens = new RangeSetBuilder<Decoration>()
  const { doc } = view.state
  const tree = syntaxTree(view.state)
  const next = new Map<string, Array<HighlightToken>>()
  let last = -1
  let marked = -1
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'FencedCode') return
        const start = doc.lineAt(node.from).number
        const end = doc.lineAt(node.to).number
        for (let n = Math.max(start, last + 1); n <= end; n++) {
          const line = doc.line(n)
          if (line.from > to) break
          if (line.to < from) continue
          lines.add(
            line.from,
            line.from,
            start === end
              ? onlyLine
              : n === start
                ? firstLine
                : n === end
                  ? lastLine
                  : codeLine,
          )
          last = n
        }

        const info = node.node.getChild('CodeInfo')
        const text = node.node.getChild('CodeText')
        const lang =
          info && fenceLanguage(doc.sliceString(info.from, info.to), nested)
        if (!lang || !text) return false
        const code = doc.sliceString(text.from, text.to)
        const key = `${lang}\n${code}`
        const found =
          next.get(key) ??
          cache.get(key) ??
          highlighter.tokenize(code, { lang }).tokens
        next.set(key, found)
        let pos = text.from
        for (const token of found) {
          const stop = pos + token.value.length
          if (token.className && stop > from && pos < to && pos >= marked) {
            tokens.add(pos, stop, mark(token.className))
            marked = stop
          }
          pos = stop
        }
        return false
      },
    })
  }
  cache = next
  return { lines: lines.finish(), tokens: tokens.finish() }
}

/**
 * Fenced code reads as a block, as in the preview, and is coloured by the
 * preview's highlighter in the languages the editor has no grammar for.
 */
export function codeBlocks(nested: ReadonlySet<string>) {
  const plugin = ViewPlugin.fromClass(
    class {
      lines: DecorationSet
      tokens: DecorationSet
      constructor(view: EditorView) {
        ;({ lines: this.lines, tokens: this.tokens } = decorations(
          view,
          nested,
        ))
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || treeChanged(update))
          ({ lines: this.lines, tokens: this.tokens } = decorations(
            update.view,
            nested,
          ))
      }
    },
  )
  return [
    plugin.extension,
    EditorView.decorations.of(
      (view) => view.plugin(plugin)?.lines ?? Decoration.none,
    ),
    // Highest, so token colours sit inside the grammar's grey code spans.
    Prec.highest(
      EditorView.decorations.of(
        (view) => view.plugin(plugin)?.tokens ?? Decoration.none,
      ),
    ),
    EditorView.baseTheme({
      '.cm-md-code': {
        backgroundColor:
          'color-mix(in oklch, var(--foreground) 4%, transparent)',
      },
      '.cm-md-code-first': { boxShadow: 'inset 0 1px 0 var(--border)' },
      '.cm-md-code-last': { boxShadow: 'inset 0 -1px 0 var(--border)' },
      '.cm-md-code-first.cm-md-code-last': {
        boxShadow: 'inset 0 1px 0 var(--border), inset 0 -1px 0 var(--border)',
      },
    }),
  ]
}
