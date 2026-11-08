import { history, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { afterEach, describe, expect, it } from 'vitest'

import { draftName, holdDraftEdits, replayDraftEdits } from './draft'

const views: Array<EditorView> = []

afterEach(() => views.splice(0).forEach((view) => view.destroy()))

/** A draft that holds its edits for `fileId`, as the draft pane does. */
function draft(fileId: string) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      extensions: EditorView.updateListener.of((update) => {
        if (update.docChanged) holdDraftEdits(fileId, update)
      }),
    }),
  })
  views.push(view)
  return view
}

/** The file's editor, opened on the text the draft saved. */
function fileEditor(doc: string, extensions: Extension = []) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, extensions: [history(), extensions] }),
  })
  views.push(view)
  return view
}

function type(view: EditorView, text: string) {
  const at = view.state.selection.main.head
  view.dispatch({
    changes: { from: at, insert: text },
    selection: { anchor: at + text.length },
    userEvent: 'input.type',
  })
}

describe('draftName', () => {
  it('stays untyped until a type is picked', () => {
    expect(draftName(null)).toBe('untitled')
    expect(draftName('json')).toBe('untitled.json')
    expect(draftName('md')).toBe('untitled.md')
  })
})

describe('replayDraftEdits', () => {
  it('carries the edits, cursor and history over to the file', () => {
    const view = draft('a')
    type(view, '<a')
    type(view, '/>')
    const editor = fileEditor('<a/>')

    replayDraftEdits('a', editor)

    expect(editor.state.doc.toString()).toBe('<a/>')
    expect(editor.state.selection.main.head).toBe(4)
    // Typing in quick succession undoes as one step, as in the editor.
    undo(editor)
    expect(editor.state.doc.toString()).toBe('')
  })

  it('keeps the paste a paste, so its type can be offered', () => {
    const view = draft('b')
    view.dispatch({
      changes: { from: 0, insert: '{"a": 1}' },
      userEvent: 'input.paste',
    })
    const pastes: Array<boolean> = []
    const editor = fileEditor(
      '{"a": 1}',
      EditorView.updateListener.of((update) => {
        for (const tr of update.transactions)
          if (tr.docChanged) pastes.push(tr.isUserEvent('input.paste'))
      }),
    )

    replayDraftEdits('b', editor)

    expect(pastes).toEqual([false, true])
    expect(editor.state.doc.toString()).toBe('{"a": 1}')
  })

  it('leaves the file alone when its text changed since', () => {
    type(draft('c'), 'draft')
    const editor = fileEditor('changed elsewhere')

    replayDraftEdits('c', editor)

    expect(editor.state.doc.toString()).toBe('changed elsewhere')
    undo(editor)
    expect(editor.state.doc.toString()).toBe('changed elsewhere')
  })

  it('only replays in the editor of the draft’s file', () => {
    type(draft('d'), 'x')
    const other = fileEditor('x')

    replayDraftEdits('e', other)
    undo(other)
    expect(other.state.doc.toString()).toBe('x')

    const editor = fileEditor('x')
    replayDraftEdits('d', editor)
    undo(editor)
    expect(editor.state.doc.toString()).toBe('')
  })
})
