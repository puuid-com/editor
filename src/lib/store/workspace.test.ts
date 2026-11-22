import { afterEach, expect, it, vi } from 'vitest'

import { deleteDiskLink, diskStore, rootsStore, setDiskLink } from './disk'
import { createFile } from './files'
import { workspaceReady as collectionsReady } from './persist'
import { DISK_WAIT_MS, workspaceReady } from './workspace'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// Plain objects stand in for handles: IndexedDB stores anything it can clone.
const link = (name: string, saved: string) => ({
  handle: { kind: 'file', name } as unknown as FileSystemFileHandle,
  saved,
  modified: 1,
})

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Stores links to disk, then holds their store the way another tab stuck
 * in the middle of a write does, until the returned function is called.
 */
async function storeLinksAndHold(
  rows: Record<string, ReturnType<typeof link>>,
) {
  const open = indexedDB.open('xml-editor-disk', 1)
  open.onupgradeneeded = () => open.result.createObjectStore('links')
  const db = await request(open)
  const write = db.transaction('links', 'readwrite')
  for (const [id, row] of Object.entries(rows)) {
    write.objectStore('links').put({ id, ...row }, id)
  }
  await new Promise((resolve) => (write.oncomplete = resolve))

  let held = true
  const hold = db.transaction('links', 'readwrite').objectStore('links')
  const keepBusy = () => {
    if (held) hold.get('none').onsuccess = keepBusy
  }
  keepBusy()
  return () => {
    held = false
  }
}

it('opens the editor while another tab holds the files on disk, then takes them in', async () => {
  await collectionsReady()
  const kept = createFile('kept.xml')
  const closed = createFile('closed.xml')
  const release = await storeLinksAndHold({
    [kept.id]: link('kept.xml', 'kept'),
    [closed.id]: link('closed.xml', 'closed'),
  })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const ready = workspaceReady()
  // The folders, which nothing holds, load on the real clock meanwhile.
  for (let tick = 0; tick < 20; tick++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  await vi.advanceTimersByTimeAsync(DISK_WAIT_MS)
  await ready
  vi.useRealTimers()
  expect(warn).toHaveBeenCalledWith(
    '[editor] Still reconnecting the files opened from disk; showing the editor without them',
  )
  expect(diskStore.state[kept.id]).toBeUndefined()

  // Used while the stored links are still on their way.
  const opened = createFile('opened.xml')
  void setDiskLink(opened.id, link('opened.xml', 'opened'))
  void deleteDiskLink(closed.id)

  release()
  await vi.waitFor(() => expect(diskStore.state[kept.id]?.saved).toBe('kept'))
  expect(diskStore.state[opened.id]?.saved).toBe('opened')
  expect(diskStore.state[closed.id]).toBeUndefined()
  expect(rootsStore.state).toEqual([])
  expect(info).toHaveBeenCalledWith(
    expect.stringMatching(
      /^\[editor\] Files and folders opened from disk reconnected after \d+ s$/,
    ),
  )
})
