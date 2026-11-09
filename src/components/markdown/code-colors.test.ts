import { parseMarkdown } from '@tanstack/markdown'
import { describe, expect, it } from 'vitest'

import {
  CODE_TAG,
  codeSpan,
  codeSpanText,
  htmlCode,
  htmlCodeSyntax,
  readCodeColor,
  readHtmlCode,
  withColor,
} from './code-colors'

const inlines = (source: string) => {
  const [block] = parseMarkdown(source, {
    extensions: [htmlCodeSyntax],
  }).children
  if (block.type !== 'paragraph') throw new Error('Not a paragraph')
  return block.children
}

const shown = (text: string, color?: string) => ({
  type: 'inlineComponent',
  name: CODE_TAG,
  tagName: CODE_TAG,
  attributes: {},
  properties: color ? { color } : {},
  children: [{ type: 'text', value: text }],
})

describe('HTML code in the preview', () => {
  it('reads <code> with its colour, and without one', () => {
    expect(
      inlines('Run <code style="color: red">deploy</code> or <code>x</code>.'),
    ).toEqual([
      { type: 'text', value: 'Run ' },
      shown('deploy', 'red'),
      { type: 'text', value: ' or ' },
      shown('x'),
      { type: 'text', value: '.' },
    ])
  })

  it('shows the text as code, not Markdown', () => {
    expect(
      inlines('<code style="color:#ff8800">**a** `b` &lt;c&gt; \\*</code>'),
    ).toEqual([shown('**a** `b` <c> *', '#ff8800')])
  })

  it('leaves other HTML and unclosed tags as text', () => {
    expect(inlines('<codex>a</codex> <b>b</b> <code>open')).toEqual([
      { type: 'text', value: '<codex>a</codex> <b>b</b> <code>open' },
    ])
  })
})

describe('code colours', () => {
  it('reads palette names, their CSS look-alikes and other plain colours', () => {
    expect(readCodeColor(' Red ')).toBe('red')
    expect(readCodeColor('orange')).toBe('amber')
    expect(readCodeColor('deeppink')).toBe('pink')
    expect(readCodeColor('grey')).toBe('gray')
    expect(readCodeColor('#FF8800')).toBe('#ff8800')
    expect(readCodeColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)')
    expect(readCodeColor('url(https://x.test/a.png)')).toBeUndefined()
    expect(readCodeColor('red; background: blue')).toBeUndefined()
  })

  it('reads a colour from any style, and the text between the tags', () => {
    const source = `<CODE class='x' style='font-weight: bold; color: teal'>a &amp; b</CODE> after`
    const code = readHtmlCode(source)!
    expect(code).toMatchObject({ text: 'a & b', color: 'teal' })
    expect(source.slice(code.textFrom, code.textTo)).toBe('a &amp; b')
    expect(source.slice(code.length)).toBe(' after')
    expect(
      readHtmlCode('<code style="background-color: red">a</code>')?.color,
    ).toBeUndefined()
  })

  it('writes CSS names any app reads, and changes only the colour', () => {
    expect(htmlCode('a', 'amber').source).toBe(
      '<code style="color: orange">a</code>',
    )
    expect(withColor('<code>', 'pink')).toBe('<code style="color: deeppink">')
    expect(
      withColor(`<code class="x" style="font-weight: bold">`, 'green'),
    ).toBe(`<code class="x" style="color: green; font-weight: bold">`)
    expect(withColor(`<code style='a: b; color: red'>`, 'teal')).toBe(
      `<code style='a: b; color: teal'>`,
    )
  })

  it.each([
    ['plain text', 'deploy'],
    ['HTML characters', 'a<b && c>d'],
    ['backslashes', 'C:\\dir\\*.md \\'],
    ['backticks', '`a` and ``b``'],
    ['kept spaces', ' padded '],
  ])('reads %s back as written', (_, text) => {
    const html = htmlCode(text, 'red')
    expect(readHtmlCode(html.source)?.text).toBe(text)
    expect(html.source.slice(html.textFrom, html.textTo)).not.toContain('<')
    // Between the fences, padding included, as a code span is read.
    const span = codeSpan(text).source.replace(/^`+|`+$/g, '')
    expect(codeSpanText(span)).toBe(text)
  })

  it('escapes pipes in a table cell', () => {
    expect(htmlCode('a|b', 'red', true).source).toBe(
      '<code style="color: red">a\\|b</code>',
    )
    expect(codeSpan('a|b', true).source).toBe('`a\\|b`')
    expect(codeSpanText('a\\|b', true)).toBe('a|b')
  })
})
