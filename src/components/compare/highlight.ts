import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { highlightTree } from '@lezer/highlight'

import { languageExtension } from '#/components/editor/language'
import { namesParent } from '#/components/editor/syntax'
import { highlightStyle } from '#/components/editor/theme'
import type { Tree } from '@lezer/common'
import type { DocLanguage } from '#/lib/document'
import type { Span } from '#/lib/diff'

/** A stretch of one line and how it reads. */
export interface Segment {
  text: string
  /** Syntax colour class, from the editor's highlight style. */
  syntax: string
  /** An XML tag or JSON key that holds other elements. */
  parent: boolean
  /** Part of what changed in the line. */
  marked: boolean
}

/** The editor's syntax colours, for a page with no editor showing. */
export const syntaxRules = highlightStyle.module?.getRules() ?? ''

/** How long reading one side's syntax may take before it shows plain. */
const PARSE_BUDGET = 300

interface Range {
  from: number
  to: number
  syntax?: string
}

/**
 * Splits each line of one side into coloured segments. The side is parsed
 * once, as the editor would, so constructs that span lines read right; a
 * file too long to parse in time shows as plain text.
 */
export class SideSyntax {
  private tree: Tree | null
  private starts: Array<number> = []

  constructor(lines: ReadonlyArray<string>, language: DocLanguage) {
    let pos = 0
    for (const line of lines) {
      this.starts.push(pos)
      pos += line.length + 1
    }
    const state = EditorState.create({
      doc: lines.join('\n'),
      extensions: languageExtension(language),
    })
    this.tree = ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET)
  }

  /** Line `index`, with `text` its content, cut where its looks change. */
  segments(
    index: number,
    text: string,
    marks: ReadonlyArray<Span> = [],
  ): Array<Segment> {
    const from = this.starts[index] ?? 0
    const to = from + text.length
    const tokens: Array<Range> = []
    const parents: Array<Range> = []
    if (this.tree && text) {
      highlightTree(
        this.tree,
        highlightStyle,
        (start, end, syntax) =>
          tokens.push({ from: start - from, to: end - from, syntax }),
        from,
        to,
      )
      this.tree.iterate({
        from,
        to,
        enter(node) {
          if (
            (node.name === 'TagName' || node.name === 'PropertyName') &&
            namesParent(node.node)
          )
            parents.push({ from: node.from - from, to: node.to - from })
        },
      })
    }
    return cut(text, tokens, parents, marks)
  }
}

/** Whether `pos` falls in one of `ranges`, sorted, walking `at` forward. */
function cover<T extends Range>(ranges: ReadonlyArray<T>, at: { i: number }) {
  return (pos: number): T | undefined => {
    while (at.i < ranges.length && ranges[at.i].to <= pos) at.i++
    const range = ranges[at.i] as T | undefined
    return range && range.from <= pos ? range : undefined
  }
}

/** Cuts `text` at every edge of a token, parent name or mark. */
function cut(
  text: string,
  tokens: ReadonlyArray<Range>,
  parents: ReadonlyArray<Range>,
  marks: ReadonlyArray<Span>,
): Array<Segment> {
  if (!text) return []
  const edges = new Set([0, text.length])
  for (const list of [tokens, parents, marks])
    for (const r of list) {
      if (r.from > 0 && r.from < text.length) edges.add(r.from)
      if (r.to > 0 && r.to < text.length) edges.add(r.to)
    }
  const points = [...edges].sort((x, y) => x - y)
  const token = cover(tokens, { i: 0 })
  const parent = cover(parents, { i: 0 })
  const mark = cover(marks, { i: 0 })
  const out: Array<Segment> = []
  for (let k = 0; k < points.length - 1; k++) {
    const start = points[k]
    const segment: Segment = {
      text: text.slice(start, points[k + 1]),
      syntax: token(start)?.syntax ?? '',
      parent: !!parent(start),
      marked: !!mark(start),
    }
    const last = out.at(-1)
    if (
      last &&
      last.syntax === segment.syntax &&
      last.parent === segment.parent &&
      last.marked === segment.marked
    )
      last.text += segment.text
    else out.push(segment)
  }
  return out
}
