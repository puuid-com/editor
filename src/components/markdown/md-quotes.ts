import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'

import { treeChanged } from '#/components/editor/syntax'

const quoteLine = Decoration.line({ class: 'cm-md-quote' })

/** Every visible line inside a `>` quote, ruled on the left as in the preview. */
function quoteDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const tree = syntaxTree(view.state)
  let last = -1
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'Blockquote') return
        const start = view.state.doc.lineAt(Math.max(node.from, from))
        const end = view.state.doc.lineAt(Math.min(node.to, to))
        for (let n = start.number; n <= end.number; n++) {
          if (n <= last) continue
          builder.add(
            view.state.doc.line(n).from,
            view.state.doc.line(n).from,
            quoteLine,
          )
          last = n
        }
        // A nested quote is already inside this one's lines.
        return false
      },
    })
  }
  return builder.finish()
}

export const quoteLines = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = quoteDecorations(view)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || treeChanged(update))
          this.decorations = quoteDecorations(update.view)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    '.cm-md-quote': {
      boxShadow: 'inset 2px 0 0 var(--border)',
    },
  }),
]
