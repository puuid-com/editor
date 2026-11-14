import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  deleteDiskEntry,
  openDiskFile,
  reconnectFolder,
  renameDiskEntry,
  startDiskSync,
} from './disk-workspace'
import { closeTabs } from './files'
import { noticeStore } from './notice-store'
import { saveToDisk } from '#/components/editor/disk'
import { listDirectory } from '#/lib/disk-tree'
import { diskStore, rootsStore, setDiskLink } from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import {
  filesCollection,
  saveContent,
  settleContentSave,
} from '#/lib/store/files'
import { workspaceReady } from '#/lib/store/workspace'
import { fakeFolder } from '#/test/fake-fs'

let stop: () => void
beforeAll(async () => {
  await workspaceReady()
  stop = startDiskSync()
})
afterAll(() => stop())

beforeEach(() => {
  // Fake handles can't be cloned into IndexedDB; links still work in memory.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** A folder opened as a workspace, with its first entries at hand. */
async function openFolder(tree: Parameters<typeof fakeFolder>[1]) {
  const folder = fakeFolder('project', tree)
  const root: DiskRoot = {
    id: crypto.randomUUID(),
    name: 'project',
    handle: folder.handle,
    access: 'granted',
  }
  rootsStore.setState((roots) => [...roots, root])
  const entry = async (path: string) => {
    const parent = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''
    const found = (await listDirectory(folder.handle, parent)).find(
      (item) => item.path === path,
    )
    if (!found) throw new Error(`No entry at ${path}`)
    return found
  }
  return { ...folder, root, entry }
}

const WAIT = { timeout: 3000 }

describe('folders opened from disk', () => {
  it('opens a file in one tab that knows where it lives', async () => {
    const { root, entry } = await openFolder({ src: { 'a.xml': '<a/>' } })
    const id = await openDiskFile(root, await entry('src/a.xml'))
    const file = filesCollection.get(id!)
    expect(file).toMatchObject({
      name: 'a.xml',
      content: '<a/>',
      location: { rootId: root.id, path: 'src/a.xml' },
    })
    expect(diskStore.state[id!]?.saved).toBe('<a/>')
    expect(await openDiskFile(root, await entry('src/a.xml'))).toBe(id)
  })

  it('writes edits to the file a moment after they are made', async () => {
    const { root, entry, read } = await openFolder({ 'a.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('a.xml')))!
    saveContent({ id, content: '<a>edited</a>' })
    await vi.waitFor(() => expect(read('a.xml')).toBe('<a>edited</a>'), WAIT)
    expect(diskStore.state[id]?.saved).toBe('<a>edited</a>')
  })

  it('takes changes made in other apps when the page regains focus', async () => {
    const { root, entry, write } = await openFolder({ 'a.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('a.xml')))!
    write('a.xml', '<a>outside</a>')
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(
      () => expect(filesCollection.get(id)?.content).toBe('<a>outside</a>'),
      WAIT,
    )
  })

  it('keeps a tab whose file was removed elsewhere, in the browser only', async () => {
    const { root, entry, handle } = await openFolder({ 'gone.xml': '<g/>' })
    const id = (await openDiskFile(root, await entry('gone.xml')))!
    await handle.removeEntry('gone.xml')
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(
      () => expect(filesCollection.get(id)?.location).toBeUndefined(),
      WAIT,
    )
    expect(filesCollection.get(id)?.content).toBe('<g/>')
    expect(noticeStore.state?.message).toContain('gone.xml')
  })

  it('preserves edits made while a focus refresh is reading the file', async () => {
    const { root, entry, write } = await openFolder({ 'race.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('race.xml')))!
    const link = diskStore.state[id]!
    write('race.xml', '<a>outside</a>')
    const disk = await link.handle.getFile()
    const pending = Promise.withResolvers<File>()
    const read = vi
      .spyOn(link.handle, 'getFile')
      .mockReturnValueOnce(pending.promise)
    const refresh = reconnectFolder(root)
    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    saveContent({ id, content: '<a>typed during refresh</a>' })
    pending.resolve(disk)
    await refresh
    expect(noticeStore.state?.message).toContain('race.xml')
    expect(filesCollection.get(id)?.content).toBe('<a>typed during refresh</a>')
    await settleContentSave()
  })

  it('ignores an old read after the file acquires a new disk baseline', async () => {
    const { root, entry, write } = await openFolder({ 'baseline.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('baseline.xml')))!
    const link = diskStore.state[id]!
    write('baseline.xml', '<a>old disk snapshot</a>')
    const disk = await link.handle.getFile()
    const pending = Promise.withResolvers<File>()
    const read = vi
      .spyOn(link.handle, 'getFile')
      .mockReturnValueOnce(pending.promise)
    const refresh = reconnectFolder(root)
    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    saveContent({ id, content: '<a>new baseline</a>' })
    await settleContentSave()
    await setDiskLink(id, {
      ...link,
      saved: '<a>new baseline</a>',
      modified: 3,
    })
    pending.resolve(disk)
    await refresh
    expect(filesCollection.get(id)?.content).toBe('<a>new baseline</a>')
    expect(diskStore.state[id]?.saved).toBe('<a>new baseline</a>')
  })

  it('closes a saved tab without archiving it', async () => {
    const { root, entry } = await openFolder({ 'a.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('a.xml')))!
    await closeTabs([id], [id])
    expect(filesCollection.has(id)).toBe(false)
    expect(diskStore.state[id]).toBeUndefined()
  })

  it('writes pending edits before closing', async () => {
    const { root, entry, read } = await openFolder({ 'a.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('a.xml')))!
    saveContent({ id, content: '<a>last</a>' })
    await closeTabs([id], [id])
    expect(read('a.xml')).toBe('<a>last</a>')
    expect(filesCollection.has(id)).toBe(false)
  })

  it('keeps a tab whose edits cannot reach disk in the browser', async () => {
    const { root, entry } = await openFolder({ 'a.xml': '<a/>' })
    const id = (await openDiskFile(root, await entry('a.xml')))!
    rootsStore.setState((roots) =>
      roots.map((r) => (r.id === root.id ? { ...r, access: 'prompt' } : r)),
    )
    saveContent({ id, content: '<a>offline</a>' })
    await closeTabs([id], [id])
    const file = filesCollection.get(id)
    expect(file?.deletedAt).toBeNull()
    expect(file?.closed).toBe(true)
    expect(file?.location).toBeUndefined()
    expect(file?.content).toBe('<a>offline</a>')
  })

  it('moves the tabs of a renamed folder', async () => {
    const { root, entry, read } = await openFolder({
      src: { 'a.xml': '<a/>' },
    })
    const id = (await openDiskFile(root, await entry('src/a.xml')))!
    expect(await renameDiskEntry(root, await entry('src'), 'lib')).toBe(true)
    expect(read('lib/a.xml')).toBe('<a/>')
    expect(filesCollection.get(id)?.location?.path).toBe('lib/a.xml')

    saveContent({ id, content: '<a>moved</a>' })
    await vi.waitFor(() => expect(read('lib/a.xml')).toBe('<a>moved</a>'), WAIT)
  })

  it('drops the tabs of a deleted folder', async () => {
    const { root, entry, has } = await openFolder({
      src: { 'a.xml': '<a/>' },
    })
    const id = (await openDiskFile(root, await entry('src/a.xml')))!
    expect(await deleteDiskEntry(root, await entry('src'))).toBe(true)
    expect(has('src')).toBe(false)
    expect(filesCollection.has(id)).toBe(false)
  })

  it('does not rename a file whose pending edits conflict with disk', async () => {
    const { root, entry, read, write, has } = await openFolder({
      'conflict.xml': '<a>original</a>',
    })
    const target = await entry('conflict.xml')
    const id = (await openDiskFile(root, target))!
    saveContent({ id, content: '<a>local</a>' })
    write('conflict.xml', '<a>external</a>')
    expect(await renameDiskEntry(root, target, 'renamed.xml')).toBe(false)
    expect(has('renamed.xml')).toBe(false)
    expect(read('conflict.xml')).toBe('<a>external</a>')
    expect(filesCollection.get(id)?.content).toBe('<a>local</a>')
    expect(diskStore.state[id]?.saved).toBe('<a>original</a>')
    expect(diskStore.state[id]?.modified).toBe(1)
  })

  it('refreshes a clean tab from the actual contents of its renamed file', async () => {
    const { root, entry, read, write } = await openFolder({
      'changed.xml': '<a>original</a>',
    })
    const target = await entry('changed.xml')
    const id = (await openDiskFile(root, target))!
    write('changed.xml', '<a>external</a>')
    expect(await renameDiskEntry(root, target, 'moved.xml')).toBe(true)
    expect(read('moved.xml')).toBe('<a>external</a>')
    expect(filesCollection.get(id)?.content).toBe('<a>external</a>')
    expect(diskStore.state[id]?.saved).toBe('<a>external</a>')
  })

  it('keeps conflict detection when local and external edits race a rename', async () => {
    const { root, entry, read, write } = await openFolder({
      'moving.xml': '<a>original</a>',
    })
    const target = await entry('moving.xml')
    const id = (await openDiskFile(root, target))!
    const getFileHandle = root.handle.getFileHandle.bind(root.handle)
    vi.spyOn(root.handle, 'getFileHandle').mockImplementation(
      async (name, options) => {
        const handle = await getFileHandle(name, options)
        if (name === 'moved.xml' && !options?.create) {
          saveContent({ id, content: '<a>local</a>' })
          write('moved.xml', '<a>external</a>')
        }
        return handle
      },
    )
    expect(await renameDiskEntry(root, target, 'moved.xml')).toBe(true)
    await saveToDisk(id)
    expect(read('moved.xml')).toBe('<a>external</a>')
    expect(filesCollection.get(id)?.content).toBe('<a>local</a>')
    expect(diskStore.state[id]?.saved).toBe('<a>original</a>')
    expect(noticeStore.state?.message).toContain('moved.xml')
  })
})
