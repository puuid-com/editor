import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownSupport } from './md-language'
import { setMarkdownLive } from './md-live'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
  document.body.innerHTML = ''
})

/** A live editor on `doc`, the caret at `^` or the end. */
function editor(doc: string) {
  const text = doc.replace('^', '')
  const caret = doc.includes('^') ? doc.indexOf('^') : text.length
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      selection: { anchor: caret },
      extensions: [markdownSupport()],
    }),
    parent: document.body,
  })
  ensureSyntaxTree(view.state, text.length, 5000)
  view.dispatch({ effects: setMarkdownLive.of(true) })
  views.push(view)
  return view
}

const lines = (view: EditorView) =>
  [...view.contentDOM.querySelectorAll('.cm-line')].map(
    (line) => line.textContent,
  )

/** Types `text` at the caret, as a keypress would. */
function type(view: EditorView, text: string) {
  const { head } = view.state.selection.main
  view.dispatch({
    changes: { from: head, insert: text },
    selection: { anchor: head + text.length },
    userEvent: 'input.type',
  })
}

function backspace(view: EditorView) {
  const { head } = view.state.selection.main
  view.dispatch({
    changes: { from: head - 1, to: head },
    userEvent: 'delete.backward',
  })
}

describe('code blocks in live preview', () => {
  const doc = 'Intro\n\n```js\nconst a = 1\n```\n\nEnd'

  it('shows the code without its fences, its language in the header', () => {
    const view = editor(doc)
    expect(lines(view)).toEqual(['Intro', '', 'const a = 1', '', 'End'])
    const lang =
      view.contentDOM.querySelector<HTMLInputElement>('.cm-md-fence-lang')
    expect(lang?.value).toBe('js')
    expect(view.contentDOM.querySelector('.cm-md-fence-close')).not.toBeNull()
  })

  it('renames the language from its header', () => {
    const view = editor(doc)
    const lang =
      view.contentDOM.querySelector<HTMLInputElement>('.cm-md-fence-lang')!
    lang.value = 'ts'
    lang.dispatchEvent(new Event('input'))
    expect(view.state.doc.line(3).text).toBe('```ts')
  })

  it('keeps the fences whole', () => {
    const view = editor(doc.replace('const', '^const'))
    backspace(view)
    expect(view.state.doc.toString()).toBe(doc)
  })

  it('removes an empty line after a block, but not the block', () => {
    const view = editor(doc.replace('\n\nEnd', '\n\n^\nEnd'))
    const before = view.state.doc.toString()
    view.dispatch({
      changes: {
        from: view.state.selection.main.head - 1,
        to: view.state.selection.main.head,
      },
      userEvent: 'delete.backward',
    })
    expect(view.state.doc.toString()).toBe(before.replace('```\n\n', '```\n'))
    // Deleting a character never takes the fence with it.
    const close = view.state.doc.line(5)
    view.dispatch({
      changes: { from: close.from - 1, to: close.to + 1 },
      userEvent: 'delete.backward',
    })
    expect(view.state.doc.line(5).text).toBe('```')
  })

  it('puts what is typed next to a fence on its own line', () => {
    const view = editor(doc)
    const close = view.state.doc.line(5)
    view.dispatch({ selection: { anchor: close.to } })
    type(view, 'x')
    expect(view.state.doc.toString()).toBe(doc.replace('```\n\n', '```\nx\n\n'))
  })

  it('shows an unclosed fence as written', () => {
    const view = editor('```js\nconst a = 1')
    expect(lines(view)).toEqual(['```js', 'const a = 1'])
  })
})

describe('tables in live preview', () => {
  const doc = '| Name | Age |\n| ---- | --: |\n| Ann  |  31 |\n\nEnd'

  const cells = (view: EditorView) => [
    ...view.contentDOM.querySelectorAll<HTMLElement>('.cm-md-table [data-row]'),
  ]

  it('shows the table as a grid, without its pipes', () => {
    const view = editor(doc)
    expect(cells(view).map((cell) => cell.textContent)).toEqual([
      'Name',
      'Age',
      'Ann',
      '31',
    ])
    expect(cells(view)[0].tagName).toBe('TH')
    expect(cells(view)[3].style.textAlign).toBe('right')
    expect(lines(view)).toEqual(['', 'End'])
  })

  it('writes what is typed in a cell back to the table', () => {
    const view = editor(doc)
    const cell = cells(view)[2]
    cell.textContent = 'Annabel | Lee'
    cell.dispatchEvent(new Event('input', { bubbles: true }))
    expect(view.state.doc.toString()).toBe(
      '| Name           | Age |\n| -------------- | --: |\n| Annabel \\| Lee |  31 |\n\nEnd',
    )
    expect(cells(view)[2]).toBe(cell)
    expect(cell.textContent).toBe('Annabel | Lee')
  })

  it('draws the Markdown in cells, and shows it as written while editing', () => {
    const view = editor(
      '| A | B |\n| - | - |\n| **bold** and *it* | `a\\|b` [docs](https://x.dev) <code style="color: red">hot</code> |',
    )
    const [, , first, second] = cells(view)
    expect(first.innerHTML).toBe('<strong>bold</strong> and <em>it</em>')
    expect(second.querySelector('code')?.textContent).toBe('a|b')
    expect(second.textContent).toBe('a|b docs hot')
    expect(second.querySelector('.md-code-color')).not.toBeNull()
    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(first.textContent).toBe('**bold** and *it*')
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(first.querySelector('strong')).not.toBeNull()
  })

  it('keeps text typed under a table out of it', () => {
    const view = editor(doc.replace('\n\nEnd', '\n^\nEnd'))
    type(view, 'Note')
    expect(view.state.doc.toString()).toBe(
      doc.replace('\n\nEnd', '\n\nNote\nEnd'),
    )
  })

  it('puts the caret under the table on a click beside it', () => {
    const view = editor(doc)
    const table = view.contentDOM.querySelector<HTMLElement>('.cm-md-table')!
    table.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    const { head } = view.state.selection.main
    expect(view.state.doc.lineAt(head).number).toBe(
      view.state.doc.lineAt(doc.indexOf('\n\nEnd') + 1).number,
    )
  })

  it('adds a line to put the caret on when the table ends the file', () => {
    const end = doc.slice(0, doc.indexOf('\n\nEnd'))
    const view = editor(end)
    const table = view.contentDOM.querySelector<HTMLElement>('.cm-md-table')!
    table.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(view.state.doc.toString()).toBe(`${end}\n`)
    expect(view.state.selection.main.head).toBe(end.length + 1)
  })

  it('adds a row on Tab past the last cell', () => {
    const view = editor(doc)
    const last = cells(view)[3]
    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    expect(view.state.doc.line(4).text).toBe('|      |     |')
    expect(cells(view)).toHaveLength(6)
  })
})
