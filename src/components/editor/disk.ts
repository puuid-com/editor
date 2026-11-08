import { readFileContent, contentBlob, isImageData } from '#/lib/image-file'
import { downloadFile, formatActive } from './actions'
import { editorStore, getText, getView } from './editor-store'
import { notify } from '#/components/app/notice-store'
import { writeFile } from '#/lib/disk-tree'
import {
  canWriteDisk,
  diskRoot,
  diskStore,
  requestRootAccess,
  setDiskLink,
} from '#/lib/store/disk'
import { filesCollection, relocateFile, renameFile } from '#/lib/store/files'
import { activeFormat } from '#/lib/store/profiles'
import { m } from '#/paraglide/messages'

// Saving back to files on disk. Every tab also saves to the browser as you
// type; these write the same text to the file it came from or a new one.

/** The text to write: what the editor shows, for the file it shows. */
function textOf(id: string) {
  const file = filesCollection.get(id)
  if (!file) return
  return editorStore.state.fileId === id && getView() ? getText() : file.content
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Asks for write access if needed. Needs a click or key press to prompt. */
async function canWrite(handle: FileSystemFileHandle) {
  const mode = { mode: 'readwrite' } as const
  if ((await handle.queryPermission(mode)) === 'granted') return true
  return (await handle.requestPermission(mode)) === 'granted'
}

async function write(id: string, handle: FileSystemFileHandle, quiet = false) {
  const text = textOf(id)
  // The file can disappear while a picker or permission prompt is open.
  if (text === undefined) return false
  await writeFile(handle, isImageData(text) ? contentBlob(text) : text)
  const { lastModified } = await handle.getFile()
  await setDiskLink(id, { handle, saved: text, modified: lastModified })
  if (!quiet) notify.success(m.saved_to_disk({ name: handle.name }))
  return true
}

/**
 * Whether the file changed on disk since it was last read or written here.
 * A newer time with the same text, such as another page of the site saving
 * the same edit, doesn't count.
 */
async function changedOnDisk(id: string) {
  const link = diskStore.state[id]
  if (!link) return false
  const file = await link.handle.getFile()
  if (file.lastModified === link.modified) return false
  const text = await readFileContent(file)
  if (text !== link.saved && text !== textOf(id)) return true
  await setDiskLink(id, { ...link, saved: text, modified: file.lastModified })
  return false
}

/**
 * A tab of a folder opened from disk asks for the whole folder again, so its
 * other files save too.
 */
async function canWriteFolder(id: string) {
  const root = diskRoot(filesCollection.get(id)?.location?.rootId)
  return !root || root.access === 'granted' || requestRootAccess(root)
}

/**
 * Writes a tab to the file on disk it is linked to. Unless `force`, it
 * stops when the file changed since it was last read or written here.
 * `quiet` skips the notice of success, for saves made while typing.
 */
export async function saveToDisk(id: string, force = false, quiet = false) {
  const link = diskStore.state[id]
  if (!link) return
  const { handle } = link
  try {
    if (!(await canWriteFolder(id)) || !(await canWrite(handle))) {
      notify.error(m.disk_permission_denied({ name: handle.name }))
      return
    }
    if (!force && (await changedOnDisk(id))) {
      notify.error(m.disk_changed({ name: handle.name }), {
        action: {
          label: m.disk_overwrite(),
          run: () => void saveToDisk(id, true),
        },
      })
      return
    }
    await write(id, handle, quiet)
  } catch (error) {
    notify.error(m.disk_save_failed({ name: handle.name }), {
      detail: error instanceof Error ? error.message : undefined,
      action: { label: m.file_save_disk(), run: () => void saveAs(id) },
    })
  }
}

/**
 * Asks where to save a tab, then links it to that file. Browsers that can't
 * write to disk download it instead.
 */
export async function saveAs(id: string) {
  const file = filesCollection.get(id)
  if (!file) return
  if (!canWriteDisk()) {
    downloadFile(id)
    return
  }
  let handle: FileSystemFileHandle
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: file.name,
      startIn: diskStore.state[id]?.handle,
    })
  } catch (error) {
    if (!isAbort(error)) {
      notify.error(m.disk_save_failed({ name: file.name }), {
        detail: error instanceof Error ? error.message : undefined,
      })
    }
    return
  }
  try {
    const saved = await write(id, handle)
    // Saved elsewhere, it no longer belongs to the folder it came from.
    if (saved && file.location) await relocateFile(id, undefined)
    if (saved && handle.name !== file.name) renameFile(id, handle.name)
  } catch (error) {
    notify.error(m.disk_save_failed({ name: handle.name }), {
      detail: error instanceof Error ? error.message : undefined,
    })
  }
}

/**
 * ⌘S. Tabs save to the browser as you type, so this formats when that
 * option is on, then writes to the tab's file on disk if it has one.
 */
export function saveActive() {
  if (activeFormat().formatOnSave) formatActive()
  const id = editorStore.state.fileId
  if (id && diskStore.state[id]) void saveToDisk(id)
  else notify.success(m.saved_locally())
  return true
}

/** ⇧⌘S: save the active tab to a file of the person's choice. */
export function saveActiveAs() {
  const id = editorStore.state.fileId
  if (id) {
    if (activeFormat().formatOnSave) formatActive()
    void saveAs(id)
  }
  return true
}
