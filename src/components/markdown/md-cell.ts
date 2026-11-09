import type { Parser, SyntaxNode } from '@lezer/common'

import { readHtmlCode } from './code-colors'
import { highlightCss } from '#/lib/store/colors'

// A table cell's Markdown drawn as it reads, for live preview's grid: bold,
// italic, struck, highlighted and code text styled, links as their text. It
// builds elements and text nodes only, so nothing in the cell runs as HTML.

/** Marks and parts of a span that don't show. */
const HIDDEN = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMark',
  'CodeMark',
  'LinkMark',
  'WikiLinkMark',
  'URL',
  'LinkTitle',
  'LinkLabel',
])

const TAGS: Record<string, string> = {
  Emphasis: 'em',
  StrongEmphasis: 'strong',
  Strikethrough: 's',
  Highlight: 'mark',
}

/** Draws the Markdown of `source` into `el`, in place of what it held. */
export function renderCell(parser: Parser, source: string, el: HTMLElement) {
  const doc = el.ownerDocument
  const text = (from: number, to: number) =>
    doc.createTextNode(source.slice(from, to))

  /** The text from `from` to `to` inside `node`, its children drawn. */
  function inner(node: SyntaxNode, from: number, to: number, into: Node) {
    let pos = from
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.to <= from || child.from >= to) continue
      if (child.from > pos) into.appendChild(text(pos, child.from))
      draw(child, into)
      pos = child.to
    }
    if (pos < to) into.appendChild(text(pos, to))
  }

  function draw(node: SyntaxNode, into: Node) {
    const { name } = node
    if (HIDDEN.has(name)) return
    const tag = TAGS[name] as string | undefined
    if (tag) {
      const span = doc.createElement(tag)
      inner(node, node.from, node.to, span)
      into.appendChild(span)
      return
    }
    switch (name) {
      case 'Escape':
        into.appendChild(text(node.from + 1, node.to))
        return
      case 'InlineCode': {
        const marks = node.getChildren('CodeMark')
        const code = doc.createElement('code')
        const from = marks.length > 1 ? marks[0].to : node.from
        const to = marks.length > 1 ? marks[marks.length - 1].from : node.to
        code.textContent = source.slice(from, to).replace(/\\\|/g, '|')
        into.appendChild(code)
        return
      }
      case 'HTMLCode': {
        const html = readHtmlCode(source.slice(node.from, node.to))
        const code = doc.createElement('code')
        code.textContent = html?.text ?? source.slice(node.from, node.to)
        if (html?.color) {
          code.className = 'md-code-color'
          code.style.setProperty('--md-code', highlightCss(html.color))
        }
        into.appendChild(code)
        return
      }
      case 'Link': {
        const marks = node.getChildren('LinkMark')
        const link = doc.createElement('span')
        link.className = 'cm-md-cell-link'
        if (marks.length > 1) inner(node, marks[0].to, marks[1].from, link)
        else inner(node, node.from, node.to, link)
        into.appendChild(link)
        return
      }
      case 'WikiLink': {
        const marks = node.getChildren('WikiLinkMark')
        const target =
          marks.length > 1
            ? source.slice(marks[0].to, marks[1].from)
            : source.slice(node.from, node.to)
        const link = doc.createElement('span')
        link.className = 'cm-md-cell-link'
        link.textContent = target.slice(target.indexOf('|') + 1)
        into.appendChild(link)
        return
      }
      default:
        inner(node, node.from, node.to, into)
    }
  }

  el.replaceChildren()
  inner(parser.parse(source).topNode, 0, source.length, el)
}
