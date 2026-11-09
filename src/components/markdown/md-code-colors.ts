import { pickedCompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { Tag, styleTags, tags as t } from '@lezer/highlight'
import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete'
import type { TagStyle } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import type { InlineContext, MarkdownConfig } from '@lezer/markdown'

import { codeColorStyle, readColorTag } from './code-colors'
import { colorLabel } from '#/components/highlights/color-label'
import { HIGHLIGHT_PRESETS, highlightCss } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'

// `` `code`{.red} `` as it is typed: the code in its colour, as the preview
// shows it, and the tag faded like the rest of the markup. `{` after inline
// code offers the colours.

const BACKTICK = 96

/** Wraps the code and its tag; one per colour, so each has its own style. */
const nodeName = (color: HighlightPreset) =>
  `${color[0].toUpperCase()}${color.slice(1)}Code`

const colorTags = Object.fromEntries(
  HIGHLIGHT_PRESETS.map((color) => [color, Tag.define(t.monospace)]),
) as Record<HighlightPreset, Tag>

export const codeColorStyles: Array<TagStyle> = HIGHLIGHT_PRESETS.map(
  (color) => ({ tag: colorTags[color], ...codeColorStyle(color) }),
)

/**
 * Inline code followed by a tag, found as InlineCode finds code: a run of
 * backticks up to the next run as long. Without a tag, InlineCode reads it.
 */
function parseColoredCode(cx: InlineContext, next: number, start: number) {
  if (next !== BACKTICK || cx.char(start - 1) === BACKTICK) return -1
  let pos = start + 1
  while (cx.char(pos) === BACKTICK) pos++
  const size = pos - start
  for (let run = 0; pos < cx.end; pos++) {
    if (cx.char(pos) !== BACKTICK) run = 0
    else if (++run === size && cx.char(pos + 1) !== BACKTICK) {
      const close = pos + 1
      const tag = readColorTag(cx.slice(close, cx.end))
      if (!tag) return -1
      const end = close + tag.length
      return cx.addElement(
        cx.elt(nodeName(tag.color), start, end, [
          cx.elt('InlineCode', start, close, [
            cx.elt('CodeMark', start, start + size),
            cx.elt('CodeMark', close - size, close),
          ]),
          cx.elt('CodeColorMark', close, end),
        ]),
      )
    }
  }
  return -1
}

export const codeColorSyntax: MarkdownConfig = {
  defineNodes: [
    ...HIGHLIGHT_PRESETS.map((color) => ({ name: nodeName(color) })),
    { name: 'CodeColorMark', style: t.processingInstruction },
  ],
  props: [
    styleTags(
      Object.fromEntries(
        HIGHLIGHT_PRESETS.map((color) => [
          `${nodeName(color)}/InlineCode`,
          colorTags[color],
        ]),
      ),
    ),
  ],
  parseInline: [
    { name: 'ColoredCode', parse: parseColoredCode, before: 'InlineCode' },
  ],
}

/* ---------------- Completion ---------------- */

const OPTION_TYPE = 'code-color'

/** Replaces the tag typed so far, the rest of one being retyped and the `}` closeBrackets added. */
function insertTag(
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
) {
  const after = view.state.sliceDoc(to, view.state.doc.lineAt(to).to)
  const rest = /^[a-z]*\}/.exec(after)?.[0] ?? ''
  view.dispatch({
    changes: { from, to: to + rest.length, insert: completion.label },
    selection: { anchor: from + completion.label.length },
    annotations: pickedCompletion.of(completion),
    userEvent: 'input.complete',
  })
}

/** `{` right after inline code offers `{.red}` and the other colours. */
export function codeColorCompletion(
  context: CompletionContext,
): CompletionResult | null {
  const typed = context.matchBefore(/`\{(?:\.[a-z]*)?/)
  if (!typed) return null
  const brace = typed.from + 1
  const mark = syntaxTree(context.state).resolveInner(brace, -1)
  const code = mark.parent
  if (mark.name !== 'CodeMark' || code?.name !== 'InlineCode') return null
  if (code.to !== brace) return null
  return {
    from: brace,
    // In the palette's order, as the highlight swatches show it.
    options: HIGHLIGHT_PRESETS.map((color, index) => ({
      label: `{.${color}}`,
      detail: colorLabel(color),
      type: OPTION_TYPE,
      boost: -index,
      apply: insertTag,
    })),
    validFor: /^\{(?:\.[a-z]*)?$/,
  }
}

/** A dot of its colour before each colour the completion offers. */
export const colorSwatch = {
  position: 20,
  render: (completion: Completion) => {
    const tag =
      completion.type === OPTION_TYPE ? readColorTag(completion.label) : null
    if (!tag) return null
    const dot = document.createElement('span')
    dot.className = 'cm-completionSwatch'
    dot.style.backgroundColor = highlightCss(tag.color)
    return dot
  },
}
