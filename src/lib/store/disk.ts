import { executeTransaction, getAll, openDatabase } from '@tanstack/react-db'
import { Store } from '@tanstack/store'

import { singleton } from './singleton'

// Tabs opened from a file on disk keep its handle, so ⌘S writes back to it.
// Only Chromium browsers hand out handles (File System Access API). Handles
// live in their own database: the workspace's holds rows a backup can carry,
// and a handle only means something in this browser.

/** A tab's file on disk. */
export interface DiskLink {
  handle: FileSystemFileHandle
  /** Text last read from or written to the file, to tell unsaved changes. */
  saved: string
  /** The file's last-modified time then, to notice changes made elsewhere. */
  modified: number
}

interface StoredLink extends DiskLink {
  id: string
}

const DATABASE_NAME = 'xml-editor-disk'
const STORE = 'links'

/** Links by file id. */
export const diskStore = singleton(
  'diskStore',
  () => new Store<Readonly<Partial<Record<string, DiskLink>>>>({}),
)

/** Whether this browser can write to a file the person picks. */
export function canWriteDisk() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

function database() {
  return singleton('diskDatabase', () =>
    openDatabase(DATABASE_NAME, 1, (db) => {
      db.createObjectStore(STORE)
    }),
  )
}

async function storedLinks() {
  const db = await database()
  const rows = await executeTransaction(db, STORE, 'readonly', (_, stores) =>
    getAll<StoredLink>(stores[STORE]),
  )
  return { db, rows }
}

/**
 * Takes in the links other pages of the site made since this one loaded,
 * such as for a file opened there, so its tab here writes to disk too. The
 * links this page holds stay: they are at least as recent as the stored ones.
 */
export async function loadNewDiskLinks(fileIds: ReadonlySet<string>) {
  if (typeof indexedDB === 'undefined') return
  try {
    const { rows } = await storedLinks()
    const added = rows.filter(
      ({ id }) => fileIds.has(id) && !diskStore.state[id],
    )
    if (!added.length) return
    diskStore.setState((links) => ({
      ...Object.fromEntries(added.map(({ id, ...link }) => [id, link])),
      ...links,
    }))
  } catch (error) {
    console.error('Could not load the links to files on disk', error)
  }
}

/** Loads the stored links, dropping those whose file is gone. */
export async function loadDiskLinks(fileIds: ReadonlySet<string>) {
  if (typeof indexedDB === 'undefined') return
  try {
    const { db, rows } = await storedLinks()
    const links: Record<string, DiskLink> = {}
    const stale: Array<string> = []
    for (const { id, ...link } of rows) {
      if (fileIds.has(id)) links[id] = link
      else stale.push(id)
    }
    diskStore.setState(() => links)
    if (stale.length) {
      await executeTransaction(db, STORE, 'readwrite', (_, stores) => {
        for (const id of stale) stores[STORE].delete(id)
      })
    }
  } catch (error) {
    // Tabs still open; they just save to the browser only.
    console.error('Could not load the links to files on disk', error)
  }
}

/** Links a tab to a file on disk, or updates what was last saved. */
export async function setDiskLink(id: string, link: DiskLink) {
  diskStore.setState((links) => ({ ...links, [id]: link }))
  try {
    const db = await database()
    await executeTransaction(db, STORE, 'readwrite', (_, stores) => {
      stores[STORE].put({ id, ...link } satisfies StoredLink, id)
    })
  } catch (error) {
    // The link works until the page reloads.
    console.error('Could not store the link to a file on disk', error)
  }
}

/** Forgets a tab's file on disk, such as when the tab closes. */
export async function deleteDiskLink(id: string) {
  diskStore.setState((links) => {
    const next = { ...links }
    delete next[id]
    return next
  })
  try {
    const db = await database()
    await executeTransaction(db, STORE, 'readwrite', (_, stores) => {
      stores[STORE].delete(id)
    })
  } catch (error) {
    console.error('Could not forget the link to a file on disk', error)
  }
}

// Folders opened from disk, each shown as a workspace in the explorer. The
// folder is the source of truth: its files open in tabs that save back to
// it. Like file handles, folder handles only mean something in this browser.
// Their own database, so opening it never waits on an older page that still
// holds the links database at its earlier version.

/** A folder opened from disk. */
export interface DiskRoot {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  /** Whether this page may read and write it; asking again needs a click. */
  access: PermissionState
}

type StoredRoot = Omit<DiskRoot, 'access'> & { added: number }

const ROOTS_DATABASE_NAME = 'xml-editor-folders'
const ROOTS = 'roots'
const READ_WRITE = { mode: 'readwrite' } as const

/** Open folders, in the order they were opened. */
export const rootsStore = singleton(
  'rootsStore',
  () => new Store<ReadonlyArray<DiskRoot>>([]),
)

/** Whether this browser can open a folder to read and write its files. */
export function canOpenFolders() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function rootsDatabase() {
  return singleton('rootsDatabase', () =>
    openDatabase(ROOTS_DATABASE_NAME, 1, (db) => {
      db.createObjectStore(ROOTS)
    }),
  )
}

// Other pages of the site reload the folders when one opens or closes here.
const rootsChannel = singleton('rootsChannel', () =>
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(ROOTS_DATABASE_NAME),
)

async function accessOf(handle: FileSystemDirectoryHandle) {
  try {
    return await handle.queryPermission(READ_WRITE)
  } catch {
    return 'denied' as const
  }
}

/** Loads the open folders and whether this page may still use them. */
export async function loadDiskRoots() {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await rootsDatabase()
    const rows = await executeTransaction(db, ROOTS, 'readonly', (_, stores) =>
      getAll<StoredRoot>(stores[ROOTS]),
    )
    rows.sort((a, b) => a.added - b.added)
    const roots = await Promise.all(
      rows.map(async ({ id, name, handle }) => ({
        id,
        name,
        handle,
        access: await accessOf(handle),
      })),
    )
    rootsStore.setState(() => roots)
  } catch (error) {
    console.error('Could not load the folders opened from disk', error)
  }
}

if (rootsChannel) rootsChannel.onmessage = () => void loadDiskRoots()

/**
 * Adds a folder the person picked, or returns the open one it already is.
 * Picking it granted access, so it starts usable.
 */
export async function addDiskRoot(handle: FileSystemDirectoryHandle) {
  for (const root of rootsStore.state) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    if (await root.handle.isSameEntry(handle)) {
      setRootAccess(root.id, 'granted')
      return root
    }
  }
  const root: DiskRoot = {
    id: crypto.randomUUID(),
    name: handle.name,
    handle,
    access: 'granted',
  }
  rootsStore.setState((roots) => [...roots, root])
  const db = await rootsDatabase()
  await executeTransaction(db, ROOTS, 'readwrite', (_, stores) => {
    stores[ROOTS].put(
      { id: root.id, name: root.name, handle, added: Date.now() },
      root.id,
    )
  })
  rootsChannel?.postMessage('roots')
  return root
}

/** Closes a folder in the editor. Nothing on disk changes. */
export async function removeDiskRoot(id: string) {
  rootsStore.setState((roots) => roots.filter((root) => root.id !== id))
  const db = await rootsDatabase()
  await executeTransaction(db, ROOTS, 'readwrite', (_, stores) => {
    stores[ROOTS].delete(id)
  })
  rootsChannel?.postMessage('roots')
}

function setRootAccess(id: string, access: PermissionState) {
  rootsStore.setState((roots) =>
    roots.map((root) => (root.id === id ? { ...root, access } : root)),
  )
}

/** Asks again for access to a folder. Needs a click or key press to prompt. */
export async function requestRootAccess(root: DiskRoot) {
  let access: PermissionState
  try {
    access = await root.handle.requestPermission(READ_WRITE)
  } catch {
    access = 'denied'
  }
  setRootAccess(root.id, access)
  return access === 'granted'
}

/** Finds an open folder by id. */
export function diskRoot(id: string | undefined) {
  return id ? rootsStore.state.find((root) => root.id === id) : undefined
}
