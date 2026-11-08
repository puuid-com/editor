import { undo, history, historyKeymap } from '@codemirror/commands'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap, runScopeHandlers } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownSupport } from './md-language'

const views: Array<EditorView> = []

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy())
})

/** An editor on `doc`, with `^` marking the caret. */
function editor(doc: string) {
  const caret = doc.indexOf('^')
  const view = new EditorView({
    state: EditorState.create({
      doc: doc.replace('^', ''),
      selection: { anchor: caret },
      extensions: [history(), keymap.of(historyKeymap), markdownSupport()],
    }),
    parent: document.body,
  })
  views.push(view)
  return view
}

/** The document with `^` at the caret. */
function shown(view: EditorView) {
  const { head } = view.state.selection.main
  const text = view.state.doc.toString()
  return text.slice(0, head) + '^' + text.slice(head)
}

const press = (view: EditorView, key: string, shiftKey = false) =>
  runScopeHandlers(
    view,
    new KeyboardEvent('keydown', { key, shiftKey }),
    'editor',
  )

function type(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + text.length),
    userEvent: 'input.type',
  })
}

const TABLE = '| a   | b   |\n| --- | --- |\n| 1   | 2   |'

describe('typing a header', () => {
  it('turns into a table on Enter', () => {
    const view = editor('| Name | Role |^')
    expect(press(view, 'Enter')).toBe(true)
    expect(shown(view)).toBe(
      '| Name | Role |\n| ---- | ---- |\n| ^     |      |',
    )
  })

  it.each([
    ['in a fence', '```\n| a | b |^\n```'],
    ['in indented code', 'text\n\n    | a | b |^'],
    ['after a paragraph line', 'text\n| a | b |^'],
    ['before the end of the line', '| a ^| b |'],
    ['on plain text', 'plain^'],
  ])('leaves Enter alone %s', (_, doc) => {
    expect(press(editor(doc), 'Enter')).toBe(false)
  })

  it('works in a quote', () => {
    const view = editor('> | a |^')
    press(view, 'Enter')
    expect(view.state.doc.toString()).toBe('> | a   |\n> | --- |\n> |     |')
  })
})

describe('moving around cells', () => {
  it('goes forward with Tab, over the rule', () => {
    const view = editor(TABLE.replace('b  ', 'b^  '))
    press(view, 'Tab')
    expect(shown(view)).toBe(TABLE.replace('1  ', '1^  '))
  })

  it('goes back with Shift-Tab', () => {
    const view = editor(TABLE.replace('2  ', '^2  '))
    press(view, 'Tab', true)
    expect(shown(view)).toBe(TABLE.replace('1  ', '1^  '))
  })

  it('stays put before the first cell, without indenting', () => {
    const view = editor(TABLE.replace('a  ', '^a  '))
    expect(press(view, 'Tab', true)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE)
  })

  it('adds a row past the last cell', () => {
    const view = editor(TABLE.replace('2  ', '2^  '))
    press(view, 'Tab')
    expect(shown(view)).toBe(`${TABLE}\n| ^    |     |`)
  })

  it('aligns what it moves away from', () => {
    const view = editor('|a|b|\n|-|-|\n|1|^2|')
    press(view, 'Tab')
    expect(view.state.doc.toString()).toBe(`${TABLE}\n|     |     |`)
  })

  it('leaves Tab alone outside a table', () => {
    expect(press(editor(`text^\n\n${TABLE}`), 'Tab')).toBe(false)
  })
})

describe('Enter in a table', () => {
  it('adds a row below', () => {
    const view = editor(TABLE.replace('1  ', '1^  '))
    press(view, 'Enter')
    expect(view.state.doc.toString()).toBe(`${TABLE}\n|     |     |`)
    expect(shown(view).endsWith('| ^    |     |')).toBe(true)
  })

  it('adds the first row from the header', () => {
    const view = editor(TABLE.replace('a  ', 'a^  '))
    press(view, 'Enter')
    expect(view.state.doc.line(3).text).toBe('|     |     |')
  })

  it('leaves the table from an empty last row', () => {
    const view = editor(`${TABLE}\n| ^    |     |`)
    press(view, 'Enter')
    expect(shown(view)).toBe(`${TABLE}\n\n^`)
  })

  it('still splits the line with Shift-Enter', () => {
    expect(press(editor(TABLE.replace('1  ', '1^  ')), 'Enter', true)).toBe(
      false,
    )
  })
})

describe('typing in a table', () => {
  it('aligns the columns', () => {
    const view = editor(TABLE.replace('1  ', '1^  '))
    type(view, '234')
    expect(shown(view)).toBe('| a    | b   |\n| ---- | --- |\n| 1234^ | 2   |')
  })

  it('lets a cell hold words', () => {
    const view = editor(TABLE.replace('1  ', '^   '))
    for (const char of 'New York') type(view, char)
    expect(view.state.doc.line(3).text).toBe('| New York | 2   |')
  })

  it('stays out of a paste', () => {
    const view = editor(TABLE.replace('1  ', '1^  '))
    view.dispatch({
      changes: { from: view.state.selection.main.head, insert: '234' },
      userEvent: 'input.paste',
    })
    expect(view.state.doc.line(3).text).toBe('| 1234   | 2   |')
  })

  it('stays out of typing outside a table', () => {
    const view = editor(`text^\n\n${TABLE}`)
    type(view, 's')
    expect(view.state.doc.toString()).toBe(`texts\n\n${TABLE}`)
  })

  it('undoes the typing and the alignment together', () => {
    const view = editor(TABLE.replace('1  ', '1^  '))
    type(view, '234')
    undo(view)
    expect(view.state.doc.toString()).toBe(TABLE)
  })

  it('leaves the rest of the document where it is', () => {
    const view = editor(`# Title\n\n${TABLE.replace('2  ', '2^  ')}\n\nAfter`)
    type(view, '3')
    expect(view.state.doc.line(1).text).toBe('# Title')
    expect(view.state.doc.line(5).text).toBe('| 1   | 23  |')
    expect(view.state.doc.line(7).text).toBe('After')
  })
})
