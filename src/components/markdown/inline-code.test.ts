import { readFileSync } from 'node:fs'

import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownSupport } from './md-language'
import { setMarkdownLive } from './md-live'
import { renderCell } from './md-cell'

// Inline code looks the same in the preview, the editor and live preview's
// tables because they all take `.md-inline-code` from styles.css. These
// tests fail if a view styles inline code on its own again.

// Vitest leaves CSS imports empty, so the file is read from disk.
const styles = readFileSync('src/styles.css', 'utf8')

/** The Markdown views' own code: the preview, the editor and its tables. */
const sources = import.meta.glob<string>(
  ['/src/components/{markdown,editor}/**/*.{ts,tsx}', '!**/*.test.*'],
  { query: '?raw', import: 'default', eager: true },
)

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  document.body.innerHTML = ''
})

function editor(doc: string, live: boolean) {
  const view = new EditorView({
    state: EditorState.create({
      doc: `${doc}\n`,
      selection: { anchor: doc.length + 1 },
      extensions: [markdownSupport()],
    }),
    parent: document.body,
  })
  ensureSyntaxTree(view.state, view.state.doc.length, 5000)
  view.dispatch({ effects: setMarkdownLive.of(live) })
  views.push(view)
  return view
}

const codeText = (root: Element) =>
  [...root.querySelectorAll('.md-inline-code')].map((el) => el.textContent)

describe('inline code', () => {
  it('has one rule, shared by the preview and the editor', () => {
    expect(styles).toMatch(
      /\.md-inline-code,\s*\.md-preview :where\(:not\(pre\) > code\) \{[^}]*padding:/,
    )
  })

  it('is not restyled anywhere else', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    for (const [path, source] of Object.entries(sources))
      expect(source, path).not.toMatch(
        /prose-code:(p[xy]?|bg|text|font)-|code['"]?: \{\s*color: 'var\(--sql-keyword\)'|tag: inlineCode,\s+(?!\s|color: 'inherit' \})/,
      )
  })

  it.each([true, false])('marks code text in the editor (live: %s)', (live) => {
    const view = editor(
      'Run `deploy` or <code style="color: red">stop</code>',
      live,
    )
    expect(codeText(view.contentDOM)).toEqual(['deploy', 'stop'])
  })

  it('marks code in live preview tables', () => {
    const cell = document.createElement('td')
    const parser = markdownSupport().language.parser
    renderCell(parser, 'a `b` <code style="color: red">c</code>', cell)
    expect(codeText(cell)).toEqual(['b', 'c'])
  })
})
