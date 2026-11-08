import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { collectPdfNotes } from './source'
import { createDiskFile, createFile, filesCollection } from '#/lib/store/files'
import { foldersCollection, moveFile, saveFolder } from '#/lib/store/folders'
import { workspaceReady } from '#/lib/store/workspace'
import { fakeFolder } from '#/test/fake-fs'
import type { DiskRoot } from '#/lib/store/disk'

beforeAll(workspaceReady)
afterEach(async () => {
  for (const file of [...filesCollection.values()])
    await filesCollection.delete(file.id).isPersisted.promise
  for (const folder of [...foldersCollection.values()])
    await foldersCollection.delete(folder.id).isPersisted.promise
})

describe('PDF source snapshots', () => {
  it('includes nested Markdown notes in numeric path order, excluding archives and other files', async () => {
    await saveFolder('Book', null, undefined)
    const book = [...foldersCollection.values()][0]
    await saveFolder('parts', book.id)
    const child = [...foldersCollection.values()].find(
      (folder) => folder.parentId === book.id,
    )!
    for (const name of ['10.md', '2.MD', 'skip.xml', 'old.md']) {
      const file = createFile(name, name)
      await moveFile(file.id, book.id)
      if (name === 'old.md')
        await filesCollection.update(file.id, (draft) => {
          draft.deletedAt = 1
        }).isPersisted.promise
    }
    const nested = createFile('nested.markdown', 'nested')
    await moveFile(nested.id, child.id)
    createFile('outside.md', 'outside')
    const result = await collectPdfNotes({ kind: 'folder', id: book.id })
    expect(result.name).toBe('Book')
    expect(result.notes.map((note) => note.path)).toEqual([
      'Book/2.MD',
      'Book/10.md',
      'Book/parts/nested.markdown',
    ])
  })

  it('reads unopened disk descendants, uses open edits, and excludes sibling directories', async () => {
    const disk = fakeFolder('Vault', {
      Book: { '1.md': 'disk', Sub: { '2.md': 'nested' } },
      Bookish: { '3.md': 'outside' },
      'image.png': 'png',
    })
    const root: DiskRoot = {
      id: 'pdf-disk',
      name: 'Vault',
      handle: disk.handle,
      access: 'granted',
    }
    createDiskFile(
      { rootId: root.id, path: 'Book/1.md' },
      'latest edits',
      'default',
    )
    const result = await collectPdfNotes({
      kind: 'disk',
      root,
      path: 'Book',
      directory: true,
    })
    expect(result.notes.map((note) => [note.path, note.content])).toEqual([
      ['Book/1.md', 'latest edits'],
      ['Book/Sub/2.md', 'nested'],
    ])
    expect(result.notes[1].location).toEqual({
      rootId: root.id,
      path: 'Book/Sub/2.md',
    })
  })

  it('reports empty folders instead of creating blank PDFs', async () => {
    await saveFolder('Empty', null)
    await expect(
      collectPdfNotes({
        kind: 'folder',
        id: [...foldersCollection.values()][0].id,
      }),
    ).rejects.toThrow('no Markdown')
  })
})
