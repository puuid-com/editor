import { parseMarkdown } from '@tanstack/markdown'
import type { BlockNode, InlineNode } from '@tanstack/markdown'
import { describe, expect, it } from 'vitest'

import { obsidianSyntax } from './obsidian-syntax'

const parse = (source: string) =>
  parseMarkdown(source, { extensions: [obsidianSyntax] }).children

const inlines = (source: string) => {
  const [paragraph] = parse(source)
  if (paragraph.type !== 'paragraph') throw new Error('Not a paragraph')
  return paragraph.children
}

const component = (node: InlineNode | BlockNode | undefined) =>
  node?.type === 'inlineComponent'
    ? { tag: node.tagName, ...node.properties }
    : node

describe('Obsidian Markdown', () => {
  it('reads links and embeds', () => {
    const [, link, , embed] = inlines(
      'See [[Plan#Goals|the plan]] and ![[diagram.png|300]]',
    )
    expect(component(link)).toEqual({
      tag: 'wiki-link',
      target: 'Plan',
      heading: 'Goals',
      alias: 'the plan',
    })
    expect(component(embed)).toEqual({
      tag: 'wiki-embed',
      target: 'diagram.png',
      alias: '300',
    })
  })

  it('leaves ordinary links, images and stray brackets alone', () => {
    expect(
      inlines('[x](y) ![a](b.png) [[]] [[a\nb]]').map((n) => n.type),
    ).toEqual(['link', 'text', 'image', 'text'])
  })

  it('reads an escaped alias pipe in a table', () => {
    const [table] = parse('| A |\n|---|\n| [[Note\\|Alias]] |')
    if (table.type !== 'table') throw new Error('Not a table')
    expect(component(table.rows[0][0].children[0])).toEqual({
      tag: 'wiki-link',
      target: 'Note',
      alias: 'Alias',
    })
  })

  it('highlights text between == marks', () => {
    const [mark, rest] = inlines('==bright **bold**== a == b')
    expect(mark).toMatchObject({ tagName: 'mark' })
    expect(rest).toEqual({ type: 'text', value: ' a == b' })
    expect(inlines('== spaced ==')).toEqual([
      { type: 'text', value: '== spaced ==' },
    ])
  })

  it('reads callouts, folded or not', () => {
    const [callout, plain] = parse(
      '> [!warning]- Careful\n> Body [[Home]]\n\n> [!TIP]\n> Tip',
    )
    expect(callout).toMatchObject({
      type: 'callout',
      kind: 'warning',
      title: 'Careful',
    })
    expect(plain).toMatchObject({ type: 'callout', kind: 'tip', title: 'Tip' })
  })
})
