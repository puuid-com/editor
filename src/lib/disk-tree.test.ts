import { describe, expect, it } from 'vitest'

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
      'notes.md',
      'src/a.json',
      'src/deep/q.sql',
    ])
    expect(await listFiles(handle, { limit: 2 })).toHaveLength(2)
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
