import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'

import {
  editorStore,
  getFileView,
  publishCursor,
  publishParse,
  registerFileView,
  setView,
} from './editor-store'

afterEach(() => setView(null))

describe('editor store', () => {
  it('updates the line when an edit preserves the cursor offset', () => {
    publishCursor(10, 1)
    publishCursor(10, 2)
    expect(editorStore.state.line).toBe(2)
  })

  it('does not republish an unchanged parse for the same file', () => {
    const doc = editorStore.state.doc
    publishParse('active', doc)
    const snapshot = editorStore.state
    publishParse('active', doc)
    expect(editorStore.state).toBe(snapshot)
    publishParse('other', doc)
    expect(editorStore.state.fileId).toBe('other')
    expect(editorStore.state.revision).toBe(snapshot.revision + 1)
  })

  it('forgets a moved view without unregistering the file it now shows', () => {
    const view = new EditorView()
    try {
      registerFileView('old', view)
      registerFileView('new', view)
      registerFileView('old', null)
      expect(getFileView('old')).toBeUndefined()
      expect(getFileView('new')).toBe(view)
    } finally {
      registerFileView('new', null)
      view.destroy()
    }
  })

  it('forgets the document once the editor goes away', () => {
    publishParse('closed', {
      language: 'json',
      nodes: [],
      root: null,
      errors: [],
    })
    const { revision } = editorStore.state

    setView(null)

    expect(editorStore.state.fileId).toBeNull()
    expect(editorStore.state.doc.language).toBe('xml')
    // Caches keyed by revision must not match the closed file's text.
    expect(editorStore.state.revision).toBeGreaterThan(revision)
  })
})
