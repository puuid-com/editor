import { readFileContent } from '#/lib/image-file'
import { Debouncer } from '@tanstack/react-pacer'

import { notify } from './notice-store'
import { closeTabs, profileFor } from './files'
import { saveToDisk } from '#/components/editor/disk'
import {
  EntryExistsError,
  createEntry,
  fileAtPath,
  isNotFound,
  isWithin,
  rebase,
  removeEntry,
  renameEntry,
} from '#/lib/disk-tree'
import type { DiskEntry, EntryKind } from '#/lib/disk-tree'
import {
  addDiskRoot,
  deleteDiskLink,
  diskRoot,
  diskStore,
  removeDiskRoot,
  requestRootAccess,
  setDiskLink,
} from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import {
  openFileIds,
  createDiskFile,
  fileAt,
  filesCollection,
  forgetFile,
  relocateFile,
  settleContentSave,
} from '#/lib/store/files'
import type { XmlFile } from '#/lib/store/files'
import { newId } from '#/lib/store/persist'
import { claimWriter, setActive, writerId } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

// Folders opened from disk. Their files open in tabs that write back to the
// folder a moment after each edit, and take changes made in other apps when
// the page comes back into focus.

/** How long after the last edit a tab writes to its file. */
const DISK_SAVE_MS = 600

function detail(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Asks for a folder and adds it as a workspace. */
export async function openFolder() {
  let handle: FileSystemDirectoryHandle
  try {
    handle = await window.showDirectoryPicker({
      id: 'workspace',
      mode: 'readwrite',
    })
  } catch (error) {
    if (!isAbort(error))
      notify.error(m.folder_open_failed(), { detail: detail(error) })
    return
  }
  try {
    return await addDiskRoot(handle)
  } catch (error) {
    notify.error(m.folder_open_failed(), { detail: detail(error) })
  }
}

/** Open tabs of a folder's files, optionally only those under `path`. */
function tabsOf(rootId: string, path?: string) {
  return [...filesCollection.values()].filter(
    (file) =>
      file.deletedAt === null &&
      file.location?.rootId === rootId &&
      (path === undefined || isWithin(file.location.path, path)),
  )
}

/** Whether a tab has edits its file on disk doesn't have yet. */
function unsaved(file: XmlFile) {
  const link = diskStore.state[file.id]
  return !!link && link.saved !== file.content
}

/** Asks again for access to a folder, then catches up on what changed. */
export async function reconnectFolder(root: DiskRoot) {
  if (!(await requestRootAccess(root))) {
    notify.error(m.folder_permission_denied({ name: root.name }))
    return false
  }
  await Promise.all(
    tabsOf(root.id)
      .filter(unsaved)
      .map((file) => saveToDisk(file.id, false, true)),
  )
  await syncFromDisk()
  return true
}

const opening = new Map<string, Promise<string | undefined>>()

/** Opens a file of a folder in a tab, or shows the tab it is already in. */
export function openDiskFile(root: DiskRoot, entry: DiskEntry) {
  const open = fileAt(root.id, entry.path)
  if (open) {
    setActive(open.id)
    return Promise.resolve(open.id)
  }
  // Two quick clicks would otherwise open it twice.
  const key = `${root.id}/${entry.path}`
  let pending = opening.get(key)
  if (!pending) {
    pending = readIntoTab(root, entry).finally(() => opening.delete(key))
    opening.set(key, pending)
  }
  return pending
}

async function readIntoTab(root: DiskRoot, entry: DiskEntry) {
  const handle = entry.handle as FileSystemFileHandle
  try {
    const disk = await handle.getFile()
    const text = await readFileContent(disk)
    const file = createDiskFile(
      { rootId: root.id, path: entry.path },
      text,
      profileFor(entry.name, text),
    )
    await setDiskLink(file.id, {
      handle,
      saved: text,
      modified: disk.lastModified,
    })
    setActive(file.id)
    return file.id
  } catch (error) {
    notify.error(m.file_import_failed({ name: entry.name }), {
      detail: detail(error),
    })
  }
}

function failed(error: unknown) {
  notify.error(
    error instanceof EntryExistsError
      ? m.folder_entry_exists({ name: error.message })
      : m.explorer_failed(),
    { detail: error instanceof EntryExistsError ? undefined : detail(error) },
  )
  return false
}

/** Creates a file or folder on disk; a new file opens in a tab. */
export async function createDiskEntry(
  root: DiskRoot,
  parent: string,
  name: string,
  kind: EntryKind,
) {
  try {
    const entry = await createEntry(root.handle, parent, name.trim(), kind)
    if (kind === 'file') await openDiskFile(root, entry)
    return true
  } catch (error) {
    return failed(error)
  }
}

/** Renames a file or folder on disk, and moves the tabs of what it holds. */
export async function renameDiskEntry(
  root: DiskRoot,
  entry: Pick<DiskEntry, 'path' | 'kind' | 'handle'>,
  name: string,
  parent?: string,
) {
  const tabs = tabsOf(root.id, entry.path)
  try {
    // Edits not written yet would be lost with the old file.
    await Promise.all(tabs.map((file) => flushDiskSave(file.id)))
    const path = await renameEntry(root.handle, entry, name.trim(), parent)
    for (const file of tabs) {
      const moved = rebase(file.location!.path, entry.path, path)
      const link = diskStore.state[file.id]
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const handle = await fileAtPath(root.handle, moved)
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const { lastModified } = await handle.getFile()
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await relocateFile(file.id, { rootId: root.id, path: moved })
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await setDiskLink(file.id, {
        handle,
        saved: link?.saved ?? file.content,
        modified: lastModified,
      })
    }
    return true
  } catch (error) {
    return failed(error)
  }
}

/** Renames a tab's file in the folder it belongs to. */
export async function renameDiskFile(id: string, name: string) {
  const file = filesCollection.get(id)
  const root = diskRoot(file?.location?.rootId)
  const link = diskStore.state[id]
  if (!file?.location || !root || !link) return false
  return renameDiskEntry(
    root,
    { path: file.location.path, kind: 'file', handle: link.handle },
    name,
  )
}

/**
 * Deletes a file or folder from disk for good, and closes the tabs of what
 * it held without archiving them.
 */
export async function deleteDiskEntry(
  root: DiskRoot,
  entry: Pick<DiskEntry, 'path' | 'kind'>,
) {
  try {
    await removeEntry(root.handle, entry.path, entry.kind)
  } catch (error) {
    if (!isNotFound(error)) return failed(error)
  }
  await dropTabs(tabsOf(root.id, entry.path).map((file) => file.id))
  return true
}

/** Closes a folder's workspace. Tabs with edits not on disk stay in the browser. */
export async function closeFolder(root: DiskRoot) {
  await closeTabs(
    tabsOf(root.id).map((file) => file.id),
    openFileIds(),
  )
  await removeDiskRoot(root.id)
}

async function dropTabs(ids: ReadonlyArray<string>) {
  for (const id of ids) {
    savers.get(id)?.cancel()
    savers.delete(id)
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await forgetFile(id)
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await deleteDiskLink(id)
  }
}

/**
 * Closes the tab of a file on disk once its edits are written. Returns false
 * when they couldn't be: the file then stays in the browser only, kept in
 * its explorer like any other.
 */
export async function closeDiskFile(id: string) {
  await flushDiskSave(id)
  const file = filesCollection.get(id)
  if (!file) return true
  if (!unsaved(file)) {
    await dropTabs([id])
    return true
  }
  await relocateFile(id, undefined)
  return false
}

// Writing edits to disk as they're made.

const savers = new Map<string, Debouncer<() => void>>()

/** Whether a tab's file can be written now, without asking. */
function writable(file: XmlFile | undefined) {
  return (
    !!file?.location &&
    file.deletedAt === null &&
    diskRoot(file.location.rootId)?.access === 'granted' &&
    unsaved(file)
  )
}

async function autosave(id: string) {
  if (writable(filesCollection.get(id))) await saveToDisk(id, false, true)
}

function scheduleSave(id: string) {
  let saver = savers.get(id)
  if (!saver) {
    saver = new Debouncer(
      () => {
        void autosave(id)
      },
      { wait: DISK_SAVE_MS },
    )
    savers.set(id, saver)
  }
  saver.maybeExecute()
}

/** Writes a tab's pending edits now instead of after the pause. */
async function flushDiskSave(id: string) {
  savers.get(id)?.cancel()
  // The editor's own save to the browser comes first.
  await settleContentSave()
  await autosave(id)
}

/** Takes the text of a file on disk into its tab, as an edit that undoes. */
async function takeDiskText(
  file: XmlFile,
  handle: FileSystemFileHandle,
  text: string,
  modified: number,
) {
  if (text !== file.content) {
    await filesCollection.update(file.id, (draft) => {
      draft.content = text
      draft.writer = claimWriter(newId())
    }).isPersisted.promise
  }
  await setDiskLink(file.id, { handle, saved: text, modified })
}

/** Takes a file's text on disk into its tab, dropping edits not written. */
export async function reloadFromDisk(id: string) {
  const file = filesCollection.get(id)
  const link = diskStore.state[id]
  if (!file || !link) return
  savers.get(id)?.cancel()
  try {
    await settleContentSave()
    const disk = await link.handle.getFile()
    await takeDiskText(
      file,
      link.handle,
      await readFileContent(disk),
      disk.lastModified,
    )
  } catch (error) {
    notify.error(m.file_import_failed({ name: file.name }), {
      detail: detail(error),
    })
  }
}

/**
 * Catches up with changes made in other apps: tabs without edits of their
 * own take the new text, tabs with some say so, and tabs whose file is gone
 * stay open in the browser only.
 */
async function syncFromDisk() {
  const files = [...filesCollection.values()].filter(
    (file) =>
      file.deletedAt === null &&
      diskRoot(file.location?.rootId)?.access === 'granted',
  )
  await Promise.all(files.map(syncFile))
}

async function syncFile(file: XmlFile) {
  const link = diskStore.state[file.id]
  if (!link) return
  try {
    const disk = await link.handle.getFile()
    if (disk.lastModified === link.modified) return
    const text = await readFileContent(disk)
    if (text === file.content || !unsaved(file)) {
      await takeDiskText(file, link.handle, text, disk.lastModified)
      return
    }
    // Touched but not changed: this tab's edits still go on top.
    if (text === link.saved) {
      await setDiskLink(file.id, { ...link, modified: disk.lastModified })
      return
    }
    notify.error(m.disk_changed({ name: file.name }), {
      action: {
        label: m.folder_reload(),
        run: () => void reloadFromDisk(file.id),
      },
    })
  } catch (error) {
    if (!isNotFound(error)) return
    await relocateFile(file.id, undefined)
    await deleteDiskLink(file.id)
    notify.info(m.folder_file_gone({ name: file.name }))
  }
}

/**
 * Starts writing this page's edits to disk, and catching up with other apps
 * whenever the page regains focus. Returns how to stop.
 */
export function startDiskSync() {
  const subscription = filesCollection.subscribeChanges(
    (changes) => {
      for (const change of changes) {
        const id = String(change.key)
        if (change.type === 'delete') {
          savers.get(id)?.cancel()
          savers.delete(id)
          continue
        }
        // Each page writes only its own edits, so two never race.
        if (change.value.writer === writerId && writable(change.value))
          scheduleSave(id)
      }
    },
    { includeInitialState: false },
  )
  const sync = () => void syncFromDisk()
  window.addEventListener('focus', sync)
  return () => {
    subscription.unsubscribe()
    window.removeEventListener('focus', sync)
  }
}
