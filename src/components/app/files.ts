import { notify } from './notice-store'
import { setDiskLink } from '#/lib/store/disk'
import { LANGUAGE_EXTENSIONS } from '#/lib/document'
import { dropEditorState } from '#/components/editor/editor-session'
import { closeFile, createFile, filesCollection } from '#/lib/store/files'
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
 * Archives the tabs `ids`, and if the active one goes, moves to the nearest
 * one left open. On failure the active tab comes back, if it is still open.
 */
export async function closeTabs(
  ids: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
) {
  const activeId = sessionStore.state.activeId
  const closing = new Set(ids)
  const wasActive = activeId !== null && closing.has(activeId)
  if (wasActive) {
    const pane = sessionStore.state.panes?.find((p) =>
      p.fileIds.includes(activeId),
    )
    setActive(
      (pane && survivor(pane.fileIds, closing, activeId)) ??
        survivor(openIds, closing, activeId) ??
        null,
    )
  }
  try {
    // One at a time, so the archive keeps them in the order they were open.
    for (const id of ids) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await closeFile(id)
      dropEditorState(id)
    }
  } catch (error) {
    if (wasActive && filesCollection.get(activeId)?.deletedAt === null)
      setActive(activeId)
    throw error
  }
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
 * Creates tabs for opened files. A base64 label opens decoded, and each file
 * takes the profile whose files it resembles, else the active one.
 */
function fileOpener() {
  const fallback = activeProfileId()
  const guess = profileGuesser()
  return (name: string, raw: string) => {
    const text = decodeBase64Zpl(raw) ?? raw
    return createFile(name, text, guess(name, text) ?? fallback)
  }
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
      const opened = open(file.name, await file.text())
      last = opened.id
      void setDiskLink(last, {
        handle,
        saved: opened.content,
        modified: file.lastModified,
      })
    } catch (error) {
      notify.error(m.file_import_failed({ name: handle.name }), {
        detail: error instanceof Error ? error.message : undefined,
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
  const contents = await Promise.allSettled(files.map((file) => file.text()))
  const open = fileOpener()
  let last: string | null = null
  for (const [i, result] of contents.entries()) {
    const { name } = files[i]
    if (result.status === 'fulfilled') {
      last = open(name, result.value).id
      continue
    }
    notify.error(m.file_import_failed({ name }), {
      detail:
        result.reason instanceof Error ? result.reason.message : undefined,
    })
  }
  if (last) setActive(last)
}
