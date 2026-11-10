import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownSupport } from './md-language'
import { setMarkdownLive, toggleTask } from './md-live'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  document.body.innerHTML = ''
})

/** A live editor on `doc`, with `^` marking the caret, else past the end. */
function editor(doc: string, live = true) {
  const text = doc.replace('^', '')
  const caret = doc.includes('^') ? doc.indexOf('^') : text.length
  const view = new EditorView({
    state: EditorState.create({
      // A last line to park the caret on, away from the text under test.
      doc: doc.includes('^') ? text : `${text}\n`,
      selection: { anchor: doc.includes('^') ? caret : text.length + 1 },
      extensions: [markdownSupport()],
    }),
    parent: document.body,
  })
  ensureSyntaxTree(view.state, view.state.doc.length, 5000)
  view.dispatch({ effects: setMarkdownLive.of(live) })
  views.push(view)
  return view
}

/** The text of each line as the editor shows it. */
const shown = (view: EditorView) =>
  [...view.contentDOM.querySelectorAll('.cm-line')]
    .map((line) => line.textContent)
    .filter(Boolean)

describe('Markdown live preview', () => {
  it('hides inline marks', () => {
    const view = editor(
      'A **bold**, *italic*, ~~gone~~, ==lit==, `code` and \\* star',
    )
    expect(shown(view)).toEqual(['A bold, italic, gone, lit, code and * star'])
  })

  it('shows link text and wikilink aliases', () => {
    const view = editor(
      '[Docs](https://x.dev "Title") [[note|Alias]] [[other]]',
    )
    expect(shown(view)).toEqual(['Docs Alias other'])
  })

  it('hides heading and quote marks, and draws bullets and rules', () => {
    const view = editor('# Title ##\n> quoted\n- item\n1. first\n\n---')
    expect(shown(view)).toEqual(['Title', ' quoted', '• item', '1. first'])
    expect(view.contentDOM.querySelector('.cm-md-rule')).not.toBeNull()
  })

  it('draws tasks as checkboxes that tick the source', () => {
    const view = editor('- [ ] todo\n- [x] done')
    const boxes =
      view.contentDOM.querySelectorAll<HTMLInputElement>('input.cm-md-task')
    expect([...boxes].map((box) => box.checked)).toEqual([false, true])
    expect(shown(view)).toEqual(['todo', 'done'])
    toggleTask(view, view.state.doc.toString().indexOf('['))
    expect(view.state.doc.line(1).text).toBe('- [x] todo')
  })

  it('shows the source the caret touches', () => {
    const view = editor('# Title\nSome **bo^ld** and *it*')
    expect(shown(view)).toEqual(['Title', 'Some **bold** and it'])
    view.dispatch({ selection: { anchor: 2 } })
    expect(shown(view)).toEqual(['# Title', 'Some bold and it'])
  })

  it('leaves images and notes alone on their line to the embed plugin', () => {
    const view = editor('![[cat.png]] ![[note]]\n![[other]]')
    expect(shown(view)).toEqual(['![[cat.png]] note', '![[other]]'])
  })

  it('hides the tags of colored code', () => {
    const view = editor('Run <code style="color: red">deploy</code> now')
    expect(shown(view)).toEqual(['Run deploy now'])
  })

  it('shows everything when off', () => {
    const view = editor('# Title **bold**', false)
    expect(shown(view)).toEqual(['# Title **bold**'])
  })
})
