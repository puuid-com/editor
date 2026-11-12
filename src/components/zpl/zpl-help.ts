import {
  Decoration,
  ViewPlugin,
  WidgetType,
  hoverTooltip,
} from '@codemirror/view'
import type { EditorState, Extension, Text } from '@codemirror/state'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { findCommandAtOffset, parseDocument } from 'zplr/web'
import type { ZplDocument } from 'zplr/web'

import { explainLines, labelDpi } from './zpl-language'
import {
  explainCommand,
  explainDocument,
  parameterIndexAt,
} from '#/lib/zpl/explain'

// What a ZPL file's editor says about its commands. Loaded on demand by
// `zpl-language.ts`, since the label parser it reads them with is large.

/** Docs are immutable, so each version is parsed at most once. */
const parsed = new WeakMap<Text, ZplDocument>()

function documentOf(state: EditorState): ZplDocument {
  let document = parsed.get(state.doc)
  if (!document) {
    document = parseDocument(state.doc.toString())
    parsed.set(state.doc, document)
  }
  return document
}

function element<TTag extends keyof HTMLElementTagNameMap>(
  tag: TTag,
  className: string | null,
  text?: string,
) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * Hovering a command explains it in plain words: what it does and what
 * each of its values means, with the hovered value picked out.
 */
const commandTooltip = hoverTooltip((view, pos) => {
  const command = findCommandAtOffset(documentOf(view.state), pos)
  if (!command) return null
  // Spans run on through the line break after the command.
  const source = view.state.sliceDoc(command.span.start, command.span.end)
  const end = command.span.start + source.trimEnd().length
  if (pos > end) return null

  const explanation = explainCommand(command, {
    dpi: view.state.facet(labelDpi),
  })
  const hovered = parameterIndexAt(command, pos)

  return {
    pos: command.span.start,
    end,
    above: true,
    create() {
      const dom = element('div', 'cm-zpl-command-tooltip')

      dom.appendChild(
        element('strong', null, `${explanation.canonical} ${explanation.name}`),
      )

      dom.appendChild(element('p', null, explanation.summary))
      if (explanation.parameters.length > 0) {
        const list = element('dl', 'cm-zpl-tooltip-parameters')
        for (const parameter of explanation.parameters) {
          const row = element(
            'div',
            parameter.rawIndex === hovered ? 'cm-zpl-tooltip-active' : null,
          )
          const value = element('dd', null)
          value.appendChild(element('code', null, parameter.value ?? '–'))
          value.appendChild(document.createTextNode(` ${parameter.meaning}`))
          row.appendChild(element('dt', null, parameter.name))
          row.appendChild(value)
          list.appendChild(row)
        }
        dom.appendChild(list)
      }
      return { dom }
    },
  }
})

class HintWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  eq(other: HintWidget) {
    return other.text === this.text
  }

  toDOM() {
    const dom = element('span', 'cm-zpl-hint', this.text)
    dom.setAttribute('aria-hidden', 'true')
    return dom
  }
}

function buildHints(view: EditorView): DecorationSet {
  if (!view.state.facet(explainLines)) return Decoration.none
  const { doc } = view.state
  const hints = explainDocument(documentOf(view.state), {
    dpi: view.state.facet(labelDpi),
  })

  // Several items on one line share a single note at its end.
  const byLine = new Map<number, string[]>()
  for (const hint of hints) {
    const line = doc.lineAt(Math.min(hint.offset, doc.length)).number
    byLine.set(line, [...(byLine.get(line) ?? []), hint.text])
  }

  return Decoration.set(
    [...byLine].map(([number, texts]) =>
      Decoration.widget({
        widget: new HintWidget(texts.join(' · ')),
        side: 1,
      }).range(doc.line(number).to),
    ),
  )
}

/** A plain-language note at the end of each line saying what it does. */
const explainHints = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildHints(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.startState.facet(labelDpi) !== update.state.facet(labelDpi) ||
        update.startState.facet(explainLines) !==
          update.state.facet(explainLines)
      ) {
        this.decorations = buildHints(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/** Hover explanations, and the notes at the end of each line. */
export const zplExplain: Extension = [commandTooltip, explainHints]
