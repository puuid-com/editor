import { readFileContent } from '#/lib/image-file'
import { Debouncer } from '@tanstack/react-pacer'

import { errorDetail, notify } from './notice-store'
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
import { isAbort } from '#/lib/file-io'
import type { DiskEntry, EntryKind } from '#/lib/disk-tree'
import {
  addDiskRoot,
  deleteDiskLink,
  diskRoot,
  diskStore,
  loadNewDiskLinks,
  removeDiskRoot,
  requestRootAccess,
  setDiskLink,
} from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import {
  openFileIds,
  createDiskFile,
  fileAt,
  closeFiles,
  filesCollection,
  relocateFile,
  settleContentSave,
} from '#/lib/store/files'
import type { XmlFile } from '#/lib/store/files'
import { newId } from '#/lib/store/persist'
import { isUnsaved } from '#/lib/store/unsaved'
import { claimWriter, setActive, writerId } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

// Folders opened from disk. Their files open in tabs that write back to the
// folder a moment after each edit, and take changes made in other apps when
// the page comes back into focus.

/** How long after the last edit a tab writes to its file. */
const DISK_SAVE_MS = 600

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
      notify.error(m.folder_open_failed(), { detail: errorDetail(error) })
    return
  }
  try {
    return await addDiskRoot(handle)
  } catch (error) {
    notify.error(m.folder_open_failed(), { detail: errorDetail(error) })
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

/** Asks again for access to a folder, then catches up on what changed. */
export async function reconnectFolder(root: DiskRoot) {
  if (!(await requestRootAccess(root))) {
    notify.error(m.folder_permission_denied({ name: root.name }))
    return false
  }
  await Promise.all(
    tabsOf(root.id)
      .filter(isUnsaved)
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
      detail: errorDetail(error),
    })
  }
}

function failed(error: unknown) {
  notify.error(
    error instanceof EntryExistsError
      ? m.folder_entry_exists({ name: error.message })
      : m.explorer_failed(),
    {
      detail:
        error instanceof EntryExistsError ? undefined : errorDetail(error),
    },
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
    // Failed/conflicting saves already report why. Moving anyway would give
    // the stale saved text a fresh disk timestamp and bypass conflict checks.
    if (tabs.some((file) => isUnsaved(filesCollection.get(file.id))))
      return false
    const path = await renameEntry(root.handle, entry, name.trim(), parent)
    for (const file of tabs) {
      const moved = rebase(file.location!.path, entry.path, path)
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const handle = await fileAtPath(root.handle, moved)
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const disk = await handle.getFile()
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const text = await readFileContent(disk)
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await relocateFile(file.id, { rootId: root.id, path: moved })
      const current = filesCollection.get(file.id)
      if (!current) continue
      if (!isUnsaved(current)) {
        // A clean tab takes edits made elsewhere before or during the move.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await takeDiskText(current, handle, text, disk.lastModified)
      } else {
        const saved = diskStore.state[file.id]?.saved ?? file.content
        // If typing and external edits raced the move, force the next save
        // to compare contents; the new timestamp cannot validate old text.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await setDiskLink(file.id, {
          handle,
          saved,
          modified: text === saved ? disk.lastModified : -1,
        })
      }
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
  await closeFiles([], ids)
  await forgetDiskLinks(ids)
}

/** Stops saving files whose tabs are gone, and forgets their links to disk. */
export async function forgetDiskLinks(ids: ReadonlyArray<string>) {
  for (const id of ids) {
    savers.get(id)?.cancel()
    savers.delete(id)
  }
  await Promise.all(ids.map(deleteDiskLink))
}

/**
 * Writes the pending edits of files on disk before their tabs close, and
 * returns those whose text is now safe there. The others couldn't be
 * written: their tabs stay in the browser only, kept in its explorer.
 */
export async function flushBeforeClose(ids: ReadonlyArray<string>) {
  await Promise.all(ids.map(flushDiskSave))
  return ids.filter((id) => !isUnsaved(filesCollection.get(id)))
}

// Writing edits to disk as they're made.

const savers = new Map<string, Debouncer<() => void>>()

/** Whether a tab's file can be written now, without asking. */
function writable(file: XmlFile | undefined) {
  return (
    !!file?.location &&
    file.deletedAt === null &&
    diskRoot(file.location.rootId)?.access === 'granted' &&
    isUnsaved(file)
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
      detail: errorDetail(error),
    })
  }
}

/**
 * Catches up with changes made in other apps: tabs without edits of their
 * own take the new text, tabs with some say so, and tabs whose file is gone
 * stay open in the browser only.
 */
async function syncFromDisk() {
  // A file opened in another page of the site has its link there.
  await loadNewDiskLinks(new Set(filesCollection.keys()))
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
  // A read can outlive an edit, close, rename or another completed sync.
  // Only apply its result to the same live file and disk baseline.
  const currentFile = () => {
    const current = filesCollection.get(file.id)
    return current?.deletedAt === null &&
      !current.closed &&
      current.location?.rootId === file.location?.rootId &&
      current.location?.path === file.location?.path &&
      diskStore.state[file.id] === link
      ? current
      : undefined
  }
  try {
    const disk = await link.handle.getFile()
    if (disk.lastModified === link.modified) return
    const text = await readFileContent(disk)
    // Pending paced writes contain a full row; let them finish before an
    // external edit so they cannot restore the old text afterwards.
    await settleContentSave()
    const current = currentFile()
    if (!current) return
    if (text === current.content || !isUnsaved(current)) {
      await takeDiskText(current, link.handle, text, disk.lastModified)
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
    if (!isNotFound(error) || !currentFile()) return
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
