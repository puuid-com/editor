import { readFileContent, IMAGE_TYPES } from '#/lib/image-file'
import {
  foldersCollection,
  saveFolder,
  moveFile,
  deleteFolder,
} from '#/lib/store/folders'
import { errorDetail, notify } from './notice-store'
import { setDiskLink } from '#/lib/store/disk'
import { LANGUAGE_EXTENSIONS } from '#/lib/languages'
import { flushBeforeClose, forgetDiskLinks } from './disk-workspace'
import { dropEditorState } from '#/components/editor/editor-session'
import {
  archiveFiles,
  closeFiles,
  createFile,
  filesCollection,
  isOpen,
  openFileIds,
  reopenFile,
} from '#/lib/store/files'
import { activeProfileId, profileGuesser } from '#/lib/store/profiles'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

import { decodeBase64Zpl } from '#/lib/zpl/base64'
import { SAMPLE_LABEL } from '#/components/zpl/sample-label'

const NEW_JSON_CONTENT = '{\n  \n}\n'

const { xml, json, flat, sql, zpl, md, txt } = LANGUAGE_EXTENSIONS

const STRUCTURED_TYPES = [
  ...xml,
  'text/xml',
  'application/xml',
  ...json,
  'application/json',
]

/** Files a custom sort order can be read from: XML and JSON only. */
export const TEMPLATE_TYPES = STRUCTURED_TYPES.join(',')

export const ACCEPTED_TYPES = [
  ...STRUCTURED_TYPES,
  ...Object.values(IMAGE_TYPES).flat(),
  ...Object.keys(IMAGE_TYPES),
  ...new Set([...flat, ...txt]),
  'text/plain',
  ...sql,
  ...zpl,
  'application/sql',
  ...md,
  'text/markdown',
].join(',')

/** File types for the open picker, as the File System Access API wants them. */
const PICKER_TYPES: Array<FilePickerAcceptType> = [
  {
    description: 'XML, JSON, TXT, SQL, ZPL, MD',
    accept: {
      ...IMAGE_TYPES,
      'application/xml': [...xml],
      'application/json': [...json],
      'text/plain': [...new Set([...flat, ...txt, ...zpl])],
      'application/sql': [...sql],
      'text/markdown': [...md],
    },
  },
]

/** An open tab, as the tab strip and the menus that list tabs show it. */
export interface TabFile {
  id: string
  name: string
  profileId: string
  /** No content, so no type or profile to show yet. */
  empty: boolean
}

/** The tab to show once `closing` are gone: the nearest one to the right, else the left. */
export function survivor(
  openIds: ReadonlyArray<string>,
  closing: ReadonlySet<string>,
  activeId: string,
) {
  const index = openIds.indexOf(activeId)
  const after = openIds.slice(index + 1).find((id) => !closing.has(id))
  const before = openIds
    .slice(0, Math.max(index, 0))
    .reverse()
    .find((id) => !closing.has(id))
  return after ?? before
}

/**
 * Takes `ids` off the tabs in one go. If the active one goes, the nearest tab
 * left takes over; if none is left, it stays until they're all gone, so the
 * strip doesn't step through each tab on the way. On failure the active tab
 * comes back, if it is still open.
 */
async function leaveTabs(
  ids: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
  remove: (ids: ReadonlyArray<string>) => Promise<void>,
) {
  const activeId = sessionStore.state.activeId
  const closing = new Set(ids)
  const wasActive = activeId !== null && closing.has(activeId)
  if (wasActive) {
    const pane = sessionStore.state.panes?.find((p) =>
      p.fileIds.includes(activeId),
    )
    const next =
      (pane && survivor(pane.fileIds, closing, activeId)) ??
      survivor(openIds, closing, activeId)
    if (next) setActive(next)
  }
  try {
    await remove(ids)
  } catch (error) {
    if (wasActive && isOpen(filesCollection.get(activeId))) setActive(activeId)
    throw error
  }
  if (wasActive && sessionStore.state.activeId === activeId) setActive(null)
  for (const id of ids) dropEditorState(id)
}

/**
 * Closes the tabs `ids`. A file on disk closes once saved there; the rest
 * stay in the browser's explorer, to open again.
 */
export function closeTabs(
  ids: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
) {
  return leaveTabs(ids, openIds, async (closing) => {
    const onDisk = closing.filter((id) => !!filesCollection.get(id)?.location)
    const saved = new Set(await flushBeforeClose(onDisk))
    await closeFiles(
      closing.filter((id) => !saved.has(id)),
      [...saved],
    )
    await forgetDiskLinks([...saved])
  })
}

/** Moves browser files to the archive, closing their tabs. */
export function deleteFiles(
  ids: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
) {
  return leaveTabs(ids, openIds, archiveFiles)
}

/** Archives a folder tree's files before removing its folders, children first. */
export async function deleteFolders(
  folderIds: ReadonlySet<string>,
  fileIds: ReadonlyArray<string>,
) {
  await deleteFiles(fileIds, openFileIds())
  for (const id of [...folderIds].reverse()) {
    // Child folders must be gone before their parent can be removed.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    if (!(await deleteFolder(id)))
      throw new Error('Folder changed during deletion')
  }
}

/** Shows a file in the editor, giving it its tab back if it was closed. */
export async function showFile(id: string) {
  await reopenFile(id)
  setActive(id)
}

// New files take the profile of the file in the editor. Opened files take
// the profile whose files they are shaped like, else that one too.

function openNew(name: string, content = '') {
  const file = createFile(name, content, activeProfileId())
  setActive(file.id)
  return file.id
}

/** An empty file, typed by what is first pasted into it. */
export const newFile = () => openNew(m.file_untitled())

export const newJsonFile = () =>
  openNew(m.file_untitled_json(), NEW_JSON_CONTENT)

export const newZplFile = () => openNew(m.file_untitled_zpl(), SAMPLE_LABEL)

export const newMarkdownFile = () => openNew(m.file_untitled_md())

export const newTextFile = () => openNew(m.file_untitled_txt())

/**
 * Picks the profile of opened files: the one whose files they look like,
 * else the active one. Made once per batch, so files opened together don't
 * sway one another.
 */
function profilePicker() {
  const fallback = activeProfileId()
  const guess = profileGuesser()
  return (name: string, text: string) => guess(name, text) ?? fallback
}

/** The profile for one opened file. */
export function profileFor(name: string, text: string) {
  return profilePicker()(name, text)
}

/** Creates tabs for opened files. A base64 label opens decoded. */
function fileOpener() {
  const pick = profilePicker()
  return (name: string, raw: string) => {
    const text = decodeBase64Zpl(raw) ?? raw
    return createFile(name, text, pick(name, text))
  }
}

function childFolder(parentId: string | null, name: string) {
  return [...foldersCollection.values()].find(
    (folder) => folder.parentId === parentId && folder.name === name,
  )
}

/** The browser folder for a picked directory's path, made where missing. */
async function folderFor(segments: ReadonlyArray<string>) {
  let parentId: string | null = null
  for (const name of segments) {
    // One level at a time: each folder needs its parent to exist.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    if (!childFolder(parentId, name)) await saveFolder(name, parentId)
    const folder = childFolder(parentId, name)
    if (!folder) break
    parentId = folder.id
  }
  return parentId
}

/** Whether the browser can open files so that they save back to disk. */
export function canOpenFromDisk() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/**
 * Asks for files on disk and opens each in a tab linked to its file, so ⌘S
 * writes back to it. Needs `canOpenFromDisk()`.
 */
export async function pickFromDisk() {
  let handles: Array<FileSystemFileHandle>
  try {
    handles = await window.showOpenFilePicker({
      multiple: true,
      types: PICKER_TYPES,
    })
  } catch {
    // Closed without picking, or the page lost focus.
    return
  }
  await importHandles(handles)
}

/** Opens files on disk in tabs linked to them. */
async function importHandles(handles: ReadonlyArray<FileSystemFileHandle>) {
  const open = fileOpener()
  let last: string | null = null
  for (const handle of handles) {
    try {
      // One at a time, so the tabs keep the picked order.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const file = await handle.getFile()
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const opened = open(file.name, await readFileContent(file))
      last = opened.id
      void setDiskLink(last, {
        handle,
        saved: opened.content,
        modified: file.lastModified,
      })
    } catch (error) {
      notify.error(m.file_import_failed({ name: handle.name }), {
        detail: errorDetail(error),
      })
    }
  }
  if (last) setActive(last)
}

/**
 * Opens dropped files. Browsers that give handles for them link the tabs to
 * the files, as when picked.
 */
export function dropFiles(data: DataTransfer) {
  const items = [...data.items].filter((item) => item.kind === 'file')
  if (
    !items.length ||
    !('getAsFileSystemHandle' in DataTransferItem.prototype)
  ) {
    void importFiles(data.files)
    return
  }
  // Handles have to be asked for before the drop event ends.
  const pending = items.map((item) => item.getAsFileSystemHandle())
  const files = [...data.files]
  void Promise.all(pending).then(
    (handles) => {
      const fileHandles = handles.filter(
        (handle): handle is FileSystemFileHandle => handle?.kind === 'file',
      )
      if (fileHandles.length === handles.length) void importHandles(fileHandles)
      else void importFiles(files)
    },
    () => void importFiles(files),
  )
}

/** Reads dropped or picked files and opens each in a tab. */
export async function importFiles(list: FileList | Array<File>) {
  const files = Array.from(list)
  const contents = await Promise.allSettled(files.map(readFileContent))
  const open = fileOpener()
  let last: string | null = null
  for (const [i, result] of contents.entries()) {
    const { name } = files[i]
    if (result.status === 'fulfilled') {
      last = open(name, result.value).id
      // A directory picker gives each file its path; keep it in the workspace.
      const folderId = await folderFor(
        (files[i].webkitRelativePath || '').split('/').slice(0, -1),
      )
      if (folderId) await moveFile(last, folderId)
      continue
    }
    notify.error(m.file_import_failed({ name }), {
      detail: errorDetail(result.reason),
    })
  }
  if (last) setActive(last)
}
