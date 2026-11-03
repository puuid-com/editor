import { describe, expect, it } from 'vitest'

import { editorStore, publishParse, setView } from './editor-store'

describe('editor store', () => {
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
