import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Prec, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  showTooltip,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { createRoot } from 'react-dom/client'
import type { EditorState, Extension } from '@codemirror/state'
import type {
  DecorationSet,
  Tooltip,
  TooltipView,
  ViewUpdate,
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { MarkdownConfig } from '@lezer/markdown'

import { CodeColorPicker } from './CodeColorPicker'
import {
  codeSpan,
  codeSpanText,
  htmlCode,
  readHtmlCode,
  withColor,
} from './code-colors'
import { treeChanged } from '#/components/editor/syntax'
import { highlightCss } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'

// Inline code as it is typed: `<code style="color: red">` reads as code in
// its colour, its tags faded like the rest of the markup, and the code the
// caret is in, plain or HTML, gets the palette above it.

const LESS_THAN = 60

/** `<code …>…</code>` as one node, so its text isn't read as Markdown. */
export const htmlCodeMarkdown: MarkdownConfig = {
  defineNodes: [
    { name: 'HTMLCode' },
    { name: 'HTMLCodeMark', style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: 'HTMLCode',
      parse(cx, next, start) {
        if (next !== LESS_THAN) return -1
        const code = readHtmlCode(cx.slice(start, cx.end))
        if (!code) return -1
        return cx.addElement(
          cx.elt('HTMLCode', start, start + code.length, [
            cx.elt('HTMLCodeMark', start, start + code.textFrom),
            cx.elt('HTMLCodeMark', start + code.textTo, start + code.length),
          ]),
        )
      },
      before: 'HTMLTag',
    },
  ],
}

/* ---------------- Finding code ---------------- */

/** A piece of inline code: where it is, where its text is, and what it shows. */
export interface InlineCode {
  from: number
  to: number
  textFrom: number
  textTo: number
  text: string
  html: boolean
  inTable: boolean
  color?: string
}

const isCode = (name: string) => name === 'InlineCode' || name === 'HTMLCode'

function readCode(state: EditorState, node: SyntaxNode): InlineCode | null {
  let inTable = false
  for (let parent = node.parent; parent; parent = parent.parent) {
    // Alt text shows no code.
    if (parent.name === 'Image') return null
    if (parent.name === 'TableCell') inTable = true
  }
  const { from, to } = node
  if (node.name === 'HTMLCode') {
    const code = readHtmlCode(state.sliceDoc(from, to))
    if (!code) return null
    return {
      from,
      to,
      textFrom: from + code.textFrom,
      textTo: from + code.textTo,
      text: code.text,
      html: true,
      inTable,
      color: code.color,
    }
  }
  const open = node.firstChild
  const close = node.lastChild
  if (!open || !close || open.to > close.from) return null
  return {
    from,
    to,
    textFrom: open.to,
    textTo: close.from,
    text: codeSpanText(state.sliceDoc(open.to, close.from), inTable),
    html: false,
    inTable,
  }
}

/** The code around `pos`, its marks included. */
export function codeAt(state: EditorState, pos: number): InlineCode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 0)
  for (; node; node = node.parent)
    if (isCode(node.name)) return readCode(state, node)
  return null
}

/** The heading line of a callout, whose title the preview shows as text. */
const CALLOUT_TITLE = /^ {0,3}>\s*\[![\w-]+\]/

/** Every piece of inline code the preview shows, in order. */
export function inlineCodes(state: EditorState): Array<InlineCode> {
  const codes: Array<InlineCode> = []
  const tree =
    ensureSyntaxTree(state, state.doc.length, 500) ?? syntaxTree(state)
  tree.iterate({
    enter: (node) => {
      if (node.name === 'Image') return false
      if (!isCode(node.name)) return undefined
      const code = readCode(state, node.node)
      if (code && !CALLOUT_TITLE.test(state.doc.lineAt(code.from).text))
        codes.push(code)
      return false
    },
  })
  return codes
}

/* ---------------- Colouring ---------------- */

/** The change that colours `code`, and where its text is once it's made. */
export interface CodeEdit {
  from: number
  to: number
  insert: string
  textFrom: number
  textTo: number
}

/** Puts `code` in `color`, or back to plain code with `null`. */
export function recolor(
  state: EditorState,
  code: InlineCode,
  color: HighlightPreset | null,
): CodeEdit | null {
  const { from, to, text, inTable } = code
  if (code.html && color) {
    const tag = withColor(state.sliceDoc(from, code.textFrom), color)
    const textFrom = from + tag.length
    return {
      from,
      to: code.textFrom,
      insert: tag,
      textFrom,
      textTo: textFrom + code.textTo - code.textFrom,
    }
  }
  if (!code.html && !color) return null
  const written = color
    ? htmlCode(text, color, inTable)
    : codeSpan(text, inTable)
  return {
    from,
    to,
    insert: written.source,
    textFrom: from + written.textFrom,
    textTo: from + written.textTo,
  }
}

/** Colours the code at the caret, which stays in its text. */
function colorAtCaret(view: EditorView, color: HighlightPreset | null) {
  const { state } = view
  const head = state.selection.main.head
  const code = codeAt(state, head)
  const edit = code && recolor(state, code, color)
  if (!code || !edit) return
  const offset = Math.max(0, head - code.textFrom)
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: Math.min(edit.textFrom + offset, edit.textTo) },
    userEvent: 'input',
  })
}

/* ---------------- The editor ---------------- */

function colorMarks(view: EditorView) {
  const marks = new RangeSetBuilder<Decoration>()
  const tree = syntaxTree(view.state)
  let done = -1
  for (const { from, to } of view.visibleRanges)
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'HTMLCode') return undefined
        // A node across two visible ranges comes up in both.
        if (node.from < done) return false
        done = node.to
        const code = readHtmlCode(view.state.sliceDoc(node.from, node.to))
        if (code && code.textTo > code.textFrom)
          marks.add(
            node.from + code.textFrom,
            node.from + code.textTo,
            Decoration.mark({
              class: 'md-code-color',
              attributes: {
                style: `--md-code: ${highlightCss(code.color ?? 'blue')}`,
              },
            }),
          )
        return false
      },
    })
  return marks.finish()
}

const htmlCodeColors = ViewPlugin.fromClass(
  class {
    marks: DecorationSet
    constructor(view: EditorView) {
      this.marks = colorMarks(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || treeChanged(update))
        this.marks = colorMarks(update.view)
    }
  },
)

function pickerView(view: EditorView): TooltipView {
  const dom = document.createElement('div')
  const root = createRoot(dom)
  const show = () => {
    dom.style.visibility = view.hasFocus ? '' : 'hidden'
  }
  const render = () => {
    const code = codeAt(view.state, view.state.selection.main.head)
    if (code)
      root.render(
        <CodeColorPicker
          value={code.color}
          onSelect={(color) => colorAtCaret(view, color)}
        />,
      )
  }
  render()
  show()
  return {
    dom,
    offset: { x: 0, y: 4 },
    update(update) {
      if (update.docChanged || update.selectionSet) render()
      if (update.focusChanged) show()
    },
    destroy: () => queueMicrotask(() => root.unmount()),
  }
}

const picker = showTooltip.compute(
  ['doc', 'selection'],
  (state): Tooltip | null => {
    const code = codeAt(state, state.selection.main.head)
    // Below in a table, whose own toolbar is above it.
    return code
      ? { pos: code.from, above: !code.inTable, create: pickerView }
      : null
  },
)

export function codeColors(): Extension {
  return [
    htmlCodeColors.extension,
    // Highest, so the colour sits inside a heading's or a link's own.
    Prec.highest(
      EditorView.decorations.of(
        (view) => view.plugin(htmlCodeColors)?.marks ?? Decoration.none,
      ),
    ),
    picker,
  ]
}
