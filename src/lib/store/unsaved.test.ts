import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDiskLink, setDiskLink } from './disk'
import { createFile, closeFiles, saveContent, settleContentSave } from './files'
import { unsavedStore } from './unsaved'
import { workspaceReady } from './workspace'

beforeAll(() => workspaceReady())

beforeEach(() => {
  // Fake handles can't be cloned into IndexedDB; links still work in memory.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const handle = {
  kind: 'file',
  name: 'a.xml',
} as unknown as FileSystemFileHandle

describe('tabs with edits not on disk', () => {
  it('follows edits, saves and the link going away', async () => {
    const unsaved = unsavedStore()
    const file = createFile('a.xml', '<a/>')
    expect(unsaved.state.has(file.id)).toBe(false)

    // Not linked to disk: edits only ever save to the browser.
    saveContent({ id: file.id, content: '<a>1</a>' })
    expect(unsaved.state.has(file.id)).toBe(false)

    await setDiskLink(file.id, { handle, saved: '<a/>', modified: 1 })
    expect(unsaved.state.has(file.id)).toBe(true)

    await setDiskLink(file.id, { handle, saved: '<a>1</a>', modified: 2 })
    expect(unsaved.state.has(file.id)).toBe(false)

    saveContent({ id: file.id, content: '<a>2</a>' })
    expect(unsaved.state.has(file.id)).toBe(true)

    await deleteDiskLink(file.id)
    expect(unsaved.state.has(file.id)).toBe(false)
  })

  it('forgets a tab that closes', async () => {
    const unsaved = unsavedStore()
    const file = createFile('b.xml', '<b/>')
    await setDiskLink(file.id, { handle, saved: '', modified: 1 })
    expect(unsaved.state.has(file.id)).toBe(true)

    await settleContentSave()
    await closeFiles([], [file.id])
    expect(unsaved.state.has(file.id)).toBe(false)
  })

  it('keeps the same set when nothing changes', () => {
    const unsaved = unsavedStore()
    const file = createFile('c.xml', '<c/>')
    const before = unsaved.state
    saveContent({ id: file.id, content: '<c>1</c>' })
    expect(unsaved.state).toBe(before)
  })
})
