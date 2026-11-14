import { describe, expect, it, vi } from 'vitest'

import {
  EntryExistsError,
  createEntry,
  isWithin,
  listDirectory,
  listFiles,
  parentPath,
  rebase,
  removeEntry,
  renameEntry,
  writeNewFile,
} from './disk-tree'
import { fakeFolder } from '#/test/fake-fs'

const names = (entries: Array<{ path: string }>) =>
  entries.map((entry) => entry.path)

describe('paths in a folder', () => {
  it('splits, nests and moves paths', () => {
    expect(parentPath('a/b/c.xml')).toBe('a/b')
    expect(parentPath('c.xml')).toBe('')
    expect(isWithin('a/b/c.xml', 'a/b')).toBe(true)
    expect(isWithin('a/bc/d.xml', 'a/b')).toBe(false)
    expect(rebase('a/b/c.xml', 'a/b', 'a/z')).toBe('a/z/c.xml')
  })
})

describe('reading a folder', () => {
  const folder = () =>
    fakeFolder('project', {
      'b.xml': '<b/>',
      'notes.md': '# Notes',
      'image.png': 'binary',
      '.env': 'SECRET=1',
      '.git': { HEAD: 'ref' },
      src: { 'a.json': '{}', deep: { 'q.sql': 'select 1' } },
      'A.xml': '<a/>',
    })

  it('lists folders first, then every file, without hidden ones', async () => {
    const { handle } = folder()
    expect(names(await listDirectory(handle, ''))).toEqual([
      'src',
      'A.xml',
      'b.xml',
      'image.png',
      'notes.md',
    ])
    expect(names(await listDirectory(handle, 'src'))).toEqual([
      'src/deep',
      'src/a.json',
    ])
  })

  it('finds every file, nearest first, up to a limit', async () => {
    const { handle } = folder()
    expect(names(await listFiles(handle))).toEqual([
      'A.xml',
      'b.xml',
      'image.png',
      'notes.md',
      'src/a.json',
      'src/deep/q.sql',
    ])
    expect(await listFiles(handle, { limit: 2 })).toHaveLength(2)
  })

  it('reuses enumerated handles when searching nested folders', async () => {
    const { handle } = fakeFolder('project', {
      src: { deep: { 'note10.md': 'ten', 'note2.md': 'two' } },
      node_modules: { 'ignored.json': '{}' },
    })
    const lookup = vi.spyOn(handle, 'getDirectoryHandle')
    expect(names(await listFiles(handle))).toEqual([
      'src/deep/note2.md',
      'src/deep/note10.md',
    ])
    expect(lookup).not.toHaveBeenCalled()
  })

  it('finds files it can’t edit too when asked, still without hidden ones', async () => {
    const { handle } = folder()
    expect(names(await listFiles(handle, { all: true }))).toEqual([
      'A.xml',
      'b.xml',
      'image.png',
      'notes.md',
      'src/a.json',
      'src/deep/q.sql',
    ])
  })
})

describe('changing a folder', () => {
  it('creates files and folders, refusing taken names', async () => {
    const { handle, has } = fakeFolder('project', { 'a.xml': '' })
    await createEntry(handle, '', 'docs', 'directory')
    const entry = await createEntry(handle, 'docs', 'b.xml', 'file')
    expect(entry.path).toBe('docs/b.xml')
    expect(has('docs/b.xml')).toBe(true)
    await expect(createEntry(handle, '', 'a.xml', 'directory')).rejects.toThrow(
      EntryExistsError,
    )
    await expect(createEntry(handle, '', 'docs', 'file')).rejects.toThrow(
      EntryExistsError,
    )
  })

  it.each([false, true])(
    'renames files and folders (move supported: %s)',
    async (movable) => {
      const { handle, read, has } = fakeFolder(
        'project',
        { 'a.xml': '<a/>', src: { 'b.xml': '<b/>', inner: { 'c.md': '#' } } },
        movable,
      )
      const [src, file] = await listDirectory(handle, '')
      expect(await renameEntry(handle, file, 'z.xml')).toBe('z.xml')
      expect(read('z.xml')).toBe('<a/>')
      expect(has('a.xml')).toBe(false)

      expect(await renameEntry(handle, src, 'lib')).toBe('lib')
      expect(read('lib/b.xml')).toBe('<b/>')
      expect(read('lib/inner/c.md')).toBe('#')
      expect(has('src')).toBe(false)
    },
  )

  it('writes a new file, making its folders and avoiding taken names', async () => {
    const { handle, read } = fakeFolder('vault', {
      attachements: { img: { 'a.png': 'old' } },
    })
    const blob = new Blob(['new'])
    expect(await writeNewFile(handle, 'attachements/img', 'a.png', blob)).toBe(
      'attachements/img/a-2.png',
    )
    expect(read('attachements/img/a.png')).toBe('old')
    expect(read('attachements/img/a-2.png')).toBe('new')
    expect(await writeNewFile(handle, 'media/new', 'b.png', blob)).toBe(
      'media/new/b.png',
    )
  })

  it('reports a permission failure instead of trying more file names', async () => {
    const { handle, has } = fakeFolder('project', {})
    const denied = new DOMException('Permission denied', 'NotAllowedError')
    const lookup = vi
      .spyOn(handle, 'getFileHandle')
      .mockRejectedValueOnce(denied)
    await expect(
      writeNewFile(handle, '', 'a.png', new Blob(['image'])),
    ).rejects.toBe(denied)
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(has('a.png')).toBe(false)
    expect(has('a-2.png')).toBe(false)
  })

  it.each([false, true])(
    'preserves a distinct destination differing only in case (move supported: %s)',
    async (movable) => {
      const { handle, read } = fakeFolder(
        'project',
        {
          'a.xml': 'source',
          'A.xml': 'destination',
        },
        movable,
      )
      const entry = (await listDirectory(handle, '')).find(
        (item) => item.name === 'a.xml',
      )!
      await expect(renameEntry(handle, entry, 'A.xml')).rejects.toThrow(
        EntryExistsError,
      )
      expect(read('a.xml')).toBe('source')
      expect(read('A.xml')).toBe('destination')
    },
  )

  it.each([false, true])(
    'uses handle identity for case-only renames (move supported: %s)',
    async (movable) => {
      const { handle, read } = fakeFolder(
        'project',
        { 'a.xml': 'source' },
        movable,
      )
      const [entry] = await listDirectory(handle, '')
      // A case-insensitive filesystem resolves both names to the same file.
      vi.spyOn(handle, 'getFileHandle').mockResolvedValueOnce(
        entry.handle as FileSystemFileHandle,
      )
      if (movable) {
        await expect(renameEntry(handle, entry, 'A.xml')).resolves.toBe('A.xml')
        expect(read('A.xml')).toBe('source')
      } else {
        // Copying onto that same file before removing the original would lose it.
        await expect(renameEntry(handle, entry, 'A.xml')).rejects.toThrow(
          EntryExistsError,
        )
        expect(read('a.xml')).toBe('source')
      }
    },
  )

  it('allows a case-only copy when the new name is free', async () => {
    const { handle, read, has } = fakeFolder('project', { 'a.xml': 'source' })
    const [entry] = await listDirectory(handle, '')
    await renameEntry(handle, entry, 'A.xml')
    expect(read('A.xml')).toBe('source')
    expect(has('a.xml')).toBe(false)
  })

  it("won't rename onto another entry", async () => {
    const { handle, read } = fakeFolder('project', {
      'a.xml': '<a/>',
      'b.xml': '<b/>',
    })
    const [a] = await listDirectory(handle, '')
    await expect(renameEntry(handle, a, 'b.xml')).rejects.toThrow(
      EntryExistsError,
    )
    expect(read('b.xml')).toBe('<b/>')
  })

  it('deletes files and whole folders', async () => {
    const { handle, has } = fakeFolder('project', {
      'a.xml': '',
      src: { 'b.xml': '' },
    })
    await removeEntry(handle, 'a.xml', 'file')
    await removeEntry(handle, 'src', 'directory')
    expect(has('a.xml')).toBe(false)
    expect(has('src')).toBe(false)
  })
})

describe('moving files between folders', () => {
  it('moves contents to a folder and back to the root', async () => {
    const { handle: root } = fakeFolder('root', {
      'note.xml': '<note/>',
      target: {},
    })
    let entry = (await listDirectory(root, '')).find(
      (item) => item.name === 'note.xml',
    )!
    expect(await renameEntry(root, entry, 'note.xml', 'target')).toBe(
      'target/note.xml',
    )
    expect(names(await listFiles(root))).toEqual(['target/note.xml'])
    entry = (await listDirectory(root, 'target'))[0]
    await renameEntry(root, entry, 'note.xml', '')
    expect(
      await (
        await root.getFileHandle('note.xml')
      )
        .getFile()
        .then((file) => file.text()),
    ).toBe('<note/>')
  })
  it('preserves both files when the destination name is taken', async () => {
    const { handle: root } = fakeFolder('root', {
      'note.xml': 'source',
      target: { 'note.xml': 'destination' },
    })
    const entry = (await listDirectory(root, '')).find(
      (item) => item.name === 'note.xml',
    )!
    await expect(
      renameEntry(root, entry, 'note.xml', 'target'),
    ).rejects.toBeInstanceOf(EntryExistsError)
    expect(names(await listFiles(root))).toHaveLength(2)
  })
})
