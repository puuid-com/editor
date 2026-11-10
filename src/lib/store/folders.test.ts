import { beforeAll, beforeEach, expect, it } from 'vitest'
import { workspaceReady } from './workspace'
import {
  foldersCollection,
  saveFolder,
  moveFile,
  deleteFolder,
  folderPath,
  folderTreeIds,
  validEntryName,
} from './folders'
import {
  createFile,
  filesCollection,
  saveContent,
  archiveFile,
  restoreFile,
} from './files'
import { createBackup, parseBackup, restoreBackup } from './backup'

beforeAll(() => workspaceReady())
beforeEach(async () => {
  for (const collection of [filesCollection, foldersCollection]) {
    const ids = [...collection.keys()]
    if (ids.length) await collection.delete(ids).isPersisted.promise
  }
})
async function folder(name: string, parentId: string | null = null) {
  expect(await saveFolder(name, parentId)).toBe(true)
  return [...foldersCollection.values()].find(
    (f) => f.name === name && f.parentId === parentId,
  )!.id
}
it('rejects cycles, missing parents, duplicate sibling names and invalid names', async () => {
  const root = await folder('Root')
  const child = await folder('Child', root)
  expect(await saveFolder('Root', child, root)).toBe(false)
  expect(await saveFolder('Root', root, root)).toBe(false)
  expect(await saveFolder('Child', root)).toBe(false)
  expect(await saveFolder('Missing', 'missing')).toBe(false)
  for (const name of ['', ' ', '..', '.', 'a/b', 'a\\b', 'a\u0000'])
    expect(validEntryName(name)).toBe(false)
  expect(folderPath(child)).toBe('Root/Child')
})
it('walks descendants once with parents first, regardless of storage order or cycles', async () => {
  await foldersCollection.insert([
    { id: 'leaf', name: 'Leaf', parentId: 'child' },
    { id: 'child', name: 'Child', parentId: 'root' },
    { id: 'root', name: 'Root', parentId: 'leaf' },
    { id: 'other', name: 'Other', parentId: null },
  ]).isPersisted.promise
  expect([...folderTreeIds('root')]).toEqual(['root', 'child', 'leaf'])
})
it('moves files without losing pending content and retains location on restore', async () => {
  const target = await folder('Target')
  const file = createFile('a.xml')
  saveContent({ id: file.id, content: '<saved />' })
  await moveFile(file.id, target)
  expect(filesCollection.get(file.id)).toMatchObject({
    content: '<saved />',
    folderId: target,
  })
  await archiveFile(file.id)
  await restoreFile(file.id)
  expect(filesCollection.get(file.id)?.folderId).toBe(target)
  expect(await deleteFolder(target)).toBe(false)
  await archiveFile(file.id)
  expect(await deleteFolder(target)).toBe(true)
  expect(filesCollection.get(file.id)?.folderId).toBeNull()
})
it('round trips folders in backups and accepts legacy backups', async () => {
  const root = await folder('Root')
  const child = await folder('Child', root)
  const file = createFile('saved.txt', 'hello')
  await moveFile(file.id, child)
  const backup = createBackup()
  const parsed = parseBackup(JSON.stringify(backup))
  expect(parsed.ok).toBe(true)
  await saveFolder('Renamed', root, child)
  await restoreBackup(backup)
  expect(folderPath(filesCollection.get(file.id)!.folderId)).toBe('Root/Child')
  const { folders: _folders, ...legacy } = backup
  const result = parseBackup(JSON.stringify(legacy))
  expect(result.ok && result.backup.folders).toEqual([])
})
