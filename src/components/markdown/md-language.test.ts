import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownSupport } from './md-language'

afterEach(() => {
  document.body.innerHTML = ''
})

function editor(doc: string) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdownSupport()] }),
    parent: document.body,
  })
  const names: Array<string> = []
  ensureSyntaxTree(view.state, doc.length, 5000)!.iterate({
    enter: (node) => {
      names.push(node.name)
    },
  })
  return { view, names }
}

/** The CSS of the editor's highlight classes on the span showing `text`. */
function styleOf(view: EditorView, text: string) {
  const span = [...view.contentDOM.querySelectorAll('span')].find(
    (element) => element.textContent === text,
  )!
  const rules = [...document.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('')
  return [...span.classList]
    .map((name) => new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(rules)?.[1])
    .join(';')
}

describe('Markdown as it is typed', () => {
  it('formats bold, italic, code, highlights and links like the preview', () => {
    const { view, names } = editor(
      '# Title\n\n__bold__ _it_ `code` ==mark== [[Note|alias]] ![[Image.png]]',
    )
    expect(names).toEqual(
      expect.arrayContaining(['Highlight', 'WikiLink', 'InlineCode']),
    )
    expect(names.filter((name) => name === 'WikiLink')).toHaveLength(2)
    expect(styleOf(view, ' Title')).toContain('font-size: 1.5em')
    expect(styleOf(view, 'bold')).toContain('font-weight: 700')
    expect(styleOf(view, 'it')).toContain('font-style: italic')
    expect(styleOf(view, 'code')).toContain('background-color')
    expect(styleOf(view, 'mark')).toContain('var(--hl-amber)')
    expect(styleOf(view, 'Note|alias')).toContain('underline')
    // The markup itself stays plain.
    expect(styleOf(view, '==')).toContain('background-color: transparent')
  })

  it('rules quoted lines and leaves lone or spaced = signs alone', () => {
    const { view, names } = editor('> quoted\n> more\n\na == b and ==no ==')
    expect(view.contentDOM.querySelectorAll('.cm-md-quote')).toHaveLength(2)
    expect(names).not.toContain('Highlight')
  })
})
