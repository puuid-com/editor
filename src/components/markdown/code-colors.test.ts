import { parseMarkdown } from '@tanstack/markdown'
import type { InlineNode } from '@tanstack/markdown'
import { describe, expect, it } from 'vitest'

import { CODE_COLOR_TAG, codeColors, readColorTag } from './code-colors'
import { obsidianSyntax } from './obsidian-syntax'

const parse = (source: string) =>
  parseMarkdown(source, { extensions: [obsidianSyntax, codeColors] }).children

const inlines = (source: string) => {
  const [block] = parse(source)
  if (block.type !== 'paragraph' && block.type !== 'heading')
    throw new Error('Not a paragraph')
  return block.children
}

const colored = (value: string, color: string): InlineNode => ({
  type: 'inlineComponent',
  name: CODE_COLOR_TAG,
  tagName: CODE_COLOR_TAG,
  attributes: {},
  properties: { color },
  children: [{ type: 'text', value }],
})

/** The text the nodes read as, with each code span in backticks. */
const text = (nodes: Array<InlineNode>): string =>
  nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : node.type === 'inlineCode'
          ? `\`${node.value}\``
          : 'children' in node
            ? text(node.children)
            : '',
    )
    .join('')

describe('coloured inline code', () => {
  it('colours code followed by a tag, and drops the tag', () => {
    expect(inlines('Run `deploy`{.red} then `check`{.green}.')).toEqual([
      { type: 'text', value: 'Run ' },
      colored('deploy', 'red'),
      { type: 'text', value: ' then ' },
      colored('check', 'green'),
      { type: 'text', value: '.' },
    ])
  })

  it('reads code fenced with longer runs of backticks', () => {
    expect(inlines('``a ` b``{.teal}')).toEqual([colored('a ` b', 'teal')])
  })

  it('colours code inside other inline markup and table cells', () => {
    const [strong, , link, , mark] = inlines(
      '**`a`{.pink}** [`b`{.amber}](x) ==`c`{.gray}==',
    )
    expect(strong).toEqual({ type: 'strong', children: [colored('a', 'pink')] })
    expect(link).toMatchObject({ children: [colored('b', 'amber')] })
    expect(mark).toMatchObject({ children: [colored('c', 'gray')] })
    const [table] = parse('| A |\n|---|\n| `x`{.purple} |')
    if (table.type !== 'table') throw new Error('Not a table')
    expect(table.rows[0][0].children).toEqual([colored('x', 'purple')])
  })

  it('leaves the heading id to the code text', () => {
    const [heading] = parse('## Use `npm`{.red}')
    expect(heading).toMatchObject({ type: 'heading', id: 'use-npm' })
  })

  it.each([
    ['an unknown colour', '`a`{.orange}'],
    ['a capitalised one', '`a`{.Red}'],
    ['a space before the tag', '`a` {.red}'],
    ['an escaped brace', '`a`\\{.red}'],
    ['no code before it', 'x{.red} and {.blue}'],
  ])('keeps the tag as text after %s', (_, source) => {
    expect(text(inlines(source))).toBe(source.replace('\\{', '{'))
  })

  it('takes the first of two tags', () => {
    expect(inlines('`a`{.red}{.blue}')).toEqual([
      colored('a', 'red'),
      { type: 'text', value: '{.blue}' },
    ])
  })

  it('leaves a tag inside the code alone', () => {
    expect(inlines('`a{.red}`')).toEqual([
      { type: 'inlineCode', value: 'a{.red}' },
    ])
  })

  it('reads only the palette’s colours, as written', () => {
    expect(readColorTag('{.blue} more')).toEqual({ color: 'blue', length: 7 })
    expect(readColorTag('x{.gray}', 1)).toEqual({ color: 'gray', length: 7 })
    expect(readColorTag('{.red')).toBeUndefined()
    expect(readColorTag('{ .red }')).toBeUndefined()
  })
})
