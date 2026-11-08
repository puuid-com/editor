import type {
  BlockParseContext,
  CalloutNode,
  InlineNode,
  InlineParseContext,
  InlineParseResult,
  MarkdownExtension,
} from '@tanstack/markdown'

import { parseWikilink, wikilinkText } from '#/lib/obsidian'

// The Markdown Obsidian adds, so notes from a vault preview as they do
// there: `[[links]]`, `![[embeds]]`, `==highlights==` and callouts, whose
// `+` or `-` fold mark GitHub's alerts don't have.

export const WIKI_LINK_TAG = 'wiki-link'
export const WIKI_EMBED_TAG = 'wiki-embed'

function parseWikilinkAt({
  source,
  index,
  inLink,
}: InlineParseContext): InlineParseResult | undefined {
  const embed = source[index] === '!'
  const open = index + Number(embed)
  if (inLink || !source.startsWith('[[', open)) return undefined
  const close = source.indexOf(']]', open + 2)
  if (close < 0) return undefined
  const inner = source.slice(open + 2, close)
  if (!inner.trim() || /[\n[\]]/.test(inner)) return undefined
  const link = parseWikilink(inner)
  const children: Array<InlineNode> = [
    { type: 'text', value: wikilinkText(link) },
  ]
  return {
    length: close + 2 - index,
    node: {
      type: 'inlineComponent',
      name: embed ? 'embed' : 'wikilink',
      tagName: embed ? WIKI_EMBED_TAG : WIKI_LINK_TAG,
      attributes: {},
      properties: { ...link },
      children,
    },
  }
}

/** `==text==`, which can't start or end with a space. */
function parseHighlightAt({
  source,
  index,
  parseInline,
}: InlineParseContext): InlineParseResult | undefined {
  const start = index + 2
  if (source[index + 1] !== '=' || /[\s=]/.test(source[start] ?? ' '))
    return undefined
  const close = source.indexOf('==', start + 1)
  if (close < 0 || /\s/.test(source[close - 1])) return undefined
  return {
    length: close + 2 - index,
    node: {
      type: 'inlineComponent',
      name: 'highlight',
      tagName: 'mark',
      attributes: {},
      children: parseInline(source.slice(start, close)),
    },
  }
}

const CALLOUT = /^ {0,3}>\s*\[!([\w-]+)\][+-]?(?:\s+(.*))?$/
const QUOTED = /^ {0,3}>\s?(.*)$/

/** `> [!type] Title`, then the rest of the quote as its body. */
function parseCallout(context: BlockParseContext): CalloutNode | undefined {
  const match = CALLOUT.exec(context.lines[context.index] ?? '')
  if (!match) return undefined
  const body: Array<string> = []
  let cursor = context.index + 1
  for (; cursor < context.lines.length; cursor++) {
    const quoted = QUOTED.exec(context.lines[cursor] ?? '')
    if (!quoted) break
    body.push(quoted[1])
  }
  context.consume(cursor - context.index)
  const kind = match[1].toLowerCase()
  return {
    type: 'callout',
    kind,
    title: match.at(2)?.trim() || kind.charAt(0).toUpperCase() + kind.slice(1),
    children: context.parseBlocks(body.join('\n')),
  }
}

export const obsidianSyntax: MarkdownExtension = {
  name: 'obsidian',
  parseBlock: parseCallout,
  inlineParser: {
    markers: '[!=',
    parse: (context) =>
      context.source[context.index] === '='
        ? parseHighlightAt(context)
        : parseWikilinkAt(context),
  },
}
