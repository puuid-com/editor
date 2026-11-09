import type { InlineNode, MarkdownExtension } from '@tanstack/markdown'

import { HIGHLIGHT_PRESETS, isPreset } from '#/lib/store/colors'
import type { HighlightPreset } from '#/lib/store/colors'

// Inline code takes a colour of the palette with Pandoc's attribute syntax,
// `` `code`{.red} ``, right after the closing backtick. Other Markdown
// readers show the code then `{.red}` as text, so the file still reads
// anywhere, and code without a tag stays blue.

export const CODE_COLOR_TAG = 'colored-code'

/** `{.purple}`, the longest tag. */
const TAG_LENGTH = Math.max(...HIGHLIGHT_PRESETS.map((c) => c.length)) + 3

/** The `{.colour}` tag at `from` in `text`: its colour and length. */
export function readColorTag(text: string, from = 0) {
  const match = /^\{\.([a-z]+)\}/.exec(text.slice(from, from + TAG_LENGTH))
  return match && isPreset(match[1])
    ? { color: match[1], length: match[0].length }
    : undefined
}

/** The ink and wash of code in `color`, as the default blue has them. */
export function codeColorStyle(color: HighlightPreset) {
  return {
    color: `oklch(from var(--hl-${color}) var(--hl-ink-l) c h)`,
    backgroundColor: `color-mix(in oklch, var(--hl-${color}) 10%, transparent)`,
  }
}

/** A tag as read, before it is known to follow code. */
const TAG_NODE = 'code-color-tag'

/** Colours the code each tag follows; a tag after anything else stays text. */
function colorCode(nodes: Array<InlineNode>): Array<InlineNode> {
  const out: Array<InlineNode> = []
  for (const node of nodes) {
    if (node.type !== 'inlineComponent' || node.name !== TAG_NODE) {
      out.push(
        'children' in node
          ? { ...node, children: colorCode(node.children) }
          : node,
      )
      continue
    }
    const code = out.at(-1)
    if (code?.type === 'inlineCode')
      out[out.length - 1] = {
        type: 'inlineComponent',
        name: CODE_COLOR_TAG,
        tagName: CODE_COLOR_TAG,
        attributes: {},
        properties: { ...node.properties },
        children: [{ type: 'text', value: code.value }],
      }
    else out.push(...node.children)
  }
  return out
}

/**
 * Reads the tags where text has them, so an escaped `\{` and the inside of
 * code stay as written, then pairs each with the code before it.
 */
export const codeColors: MarkdownExtension = {
  name: 'code-colors',
  inlineParser: {
    markers: '{',
    parse: ({ source, index }) => {
      const tag = readColorTag(source, index)
      if (!tag) return undefined
      return {
        length: tag.length,
        node: {
          type: 'inlineComponent',
          name: TAG_NODE,
          attributes: {},
          properties: { color: tag.color },
          children: [
            { type: 'text', value: source.slice(index, index + tag.length) },
          ],
        },
      }
    },
  },
  transformInline: colorCode,
}
