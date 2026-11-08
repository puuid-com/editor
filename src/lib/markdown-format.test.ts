import { describe, expect, it } from 'vitest'

import {
  atxHeadings,
  formatMarkdown,
  formatMarkdownCode,
} from './markdown-format'

describe('formatMarkdownCode', () => {
  it('formats fenced code and leaves the prose as written', async () => {
    const doc = [
      '# Title',
      '',
      '*keep*   this',
      '',
      '```ts',
      "const test='123'",
      'function a(){return 1}',
      '```',
      '',
    ].join('\n')
    expect(await formatMarkdownCode(doc)).toEqual({
      text: [
        '# Title',
        '',
        '*keep*   this',
        '',
        '```ts',
        'const test = "123";',
        'function a() {',
        '  return 1;',
        '}',
        '```',
        '',
      ].join('\n'),
      skipped: 0,
    })
  })

  it('formats JSON, CSS, XML and SQL fences', async () => {
    const { text } = await formatMarkdownCode(
      '```json\n{"a":1}\n```\n\n```css\na{color:red}\n```\n\n```xml\n<a><b/></a>\n```\n\n```sql\nselect a from t\n```\n',
    )
    expect(text).toContain('```json\n{ "a": 1 }\n```')
    expect(text).toContain('```css\na {\n  color: red;\n}\n```')
    expect(text).toContain('```xml\n<a>\n  <b />\n</a>\n```')
    expect(text).toContain('SELECT')
  })

  it('keeps a list item fence at its indent', async () => {
    const { text } = await formatMarkdownCode(
      '- step\n\n  ```js\n  let a=1\n  ```\n',
    )
    expect(text).toBe('- step\n\n  ```js\n  let a = 1;\n  ```\n')
  })

  it('leaves code that does not parse, unknown languages and quotes alone', async () => {
    const doc =
      '```ts\nconst = (\n```\n\n```rust\nfn  a(){}\n```\n\n> ```js\n> let a=1\n> ```\n'
    expect(await formatMarkdownCode(doc)).toEqual({ text: doc, skipped: 1 })
  })
})

describe('atxHeadings', () => {
  it('turns underlined headings into # ones, outside quotes', () => {
    expect(atxHeadings('Title\n=====\n\nTwo\nlines\n---\n\n> Q\n> ==\n')).toBe(
      '# Title\n\n## Two lines\n\n> Q\n> ==\n',
    )
  })

  it('leaves front matter alone', () => {
    expect(atxHeadings('---\na: 1\n---\nT\n=\n')).toBe('---\na: 1\n---\n# T\n')
  })
})

describe('formatMarkdown', () => {
  it('lays out the prose to the Prettier and markdownlint standards', async () => {
    const doc = [
      'Title',
      '=====',
      'Some *emph* and __strong__ text   kept, see http://example.com',
      '* one',
      '+ two',
      '',
      '',
      '',
      '| a | b |',
      '|---|:-:|',
      '| long cell | x |',
      '```js',
      'let a=1',
      '```',
    ].join('\n')
    expect(await formatMarkdown(doc)).toEqual({
      text: [
        '# Title',
        '',
        'Some _emph_ and **strong** text kept, see <http://example.com>',
        '',
        '- one',
        '',
        '- two',
        '',
        '| a         |  b  |',
        '| --------- | :-: |',
        '| long cell |  x  |',
        '',
        '```js',
        'let a = 1;',
        '```',
        '',
      ].join('\n'),
      skipped: 0,
    })
  })

  it('keeps Obsidian syntax, front matter and unused definitions', async () => {
    const doc = [
      '---',
      'tags: [a]',
      '---',
      '',
      '# Note',
      '',
      'See [[Other note|alias]], ![[image.png|200]], ==marked== and #tag.',
      '',
      '> [!note] Callout',
      '> body',
      '',
      '[unused]: https://example.com',
      '',
    ].join('\n')
    expect(await formatMarkdown(doc)).toEqual({ text: doc, skipped: 0 })
  })
})
