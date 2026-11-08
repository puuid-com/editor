import { LANGUAGE_EXTENSIONS } from './document'

// Reading and changing a folder opened from disk, through the handles of the
// File System Access API. Paths run from the folder with `/` between names,
// and the folder itself is ''.

export type EntryKind = 'file' | 'directory'

/** A file or folder inside a folder opened from disk. */
export interface DiskEntry {
  name: string
  path: string
  kind: EntryKind
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
}

const EDITABLE = new RegExp(
  `(${[...new Set(Object.values(LANGUAGE_EXTENSIONS).flat())]
    .map((ext) => `\\${ext}`)
    .join('|')})$`,
  'i',
)

/** Whether the editor opens a file of this name. */
export function isEditableName(name: string) {
  return EDITABLE.test(name)
}

/** Dot files and folders: settings, such as `.git` or a vault's `.obsidian`. */
function isHidden(name: string) {
  return name.startsWith('.')
}

/** Whether the explorer lists an entry: no hidden ones, and only files it can edit. */
function isListed(name: string, kind: EntryKind) {
  return !isHidden(name) && (kind === 'directory' || isEditableName(name))
}

function joinPath(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name
}

export function parentPath(path: string) {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '' : path.slice(0, slash)
}

function baseName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Whether `path` is `ancestor` or inside it. */
export function isWithin(path: string, ancestor: string) {
  return path === ancestor || path.startsWith(`${ancestor}/`)
}

/** `path` with its `from` prefix swapped for `to`, after a folder moved. */
export function rebase(path: string, from: string, to: string) {
  return to + path.slice(from.length)
}

export function isNotFound(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

async function directoryAt(root: FileSystemDirectoryHandle, path: string) {
  let directory = root
  for (const name of path ? path.split('/') : []) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    directory = await directory.getDirectoryHandle(name)
  }
  return directory
}

export async function fileAtPath(
  root: FileSystemDirectoryHandle,
  path: string,
) {
  const directory = await directoryAt(root, parentPath(path))
  return directory.getFileHandle(baseName(path))
}

const byKindThenName = (a: DiskEntry, b: DiskEntry) =>
  a.kind === b.kind
    ? a.name.localeCompare(b.name, undefined, { numeric: true })
    : a.kind === 'directory'
      ? -1
      : 1

async function readDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  keep: (name: string, kind: EntryKind) => boolean,
) {
  const directory = await directoryAt(root, path)
  const entries: Array<DiskEntry> = []
  for await (const handle of directory.values()) {
    if (keep(handle.name, handle.kind)) {
      entries.push({
        name: handle.name,
        path: joinPath(path, handle.name),
        kind: handle.kind,
        handle,
      })
    }
  }
  return entries.sort(byKindThenName)
}

/** A folder's listed entries: folders first, then files, by name. */
export function listDirectory(root: FileSystemDirectoryHandle, path: string) {
  return readDirectory(root, path, isListed)
}

/** Folders search skips: installed packages, rarely what anyone edits. */
const UNSEARCHED = new Set(['node_modules'])

/**
 * Every listed file under the folder, nearest first, up to `limit`. With
 * `all`, files the editor can't open too, such as the images a note shows.
 */
export async function listFiles(
  root: FileSystemDirectoryHandle,
  { limit = 5000, all = false } = {},
) {
  const keep = all ? (name: string) => !isHidden(name) : isListed
  const files: Array<DiskEntry> = []
  const queue = ['']
  while (queue.length && files.length < limit) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    for (const entry of await readDirectory(root, queue.shift()!, keep)) {
      if (entry.kind === 'file') {
        if (files.length < limit) files.push(entry)
      } else if (!UNSEARCHED.has(entry.name)) queue.push(entry.path)
    }
  }
  return files
}

/** Whether `directory` holds an entry called `name`, of either kind. */
async function exists(directory: FileSystemDirectoryHandle, name: string) {
  for (const get of [
    () => directory.getFileHandle(name),
    () => directory.getDirectoryHandle(name),
  ]) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await get()
      return true
    } catch (error) {
      // A folder asked for as a file, or the reverse, is still taken.
      if (!isNotFound(error)) return true
    }
  }
  return false
}

/** Replaces a file's contents, leaving it as it was if the write fails. */
export async function writeFile(
  handle: FileSystemFileHandle,
  data: string | Blob,
) {
  const stream = await handle.createWritable()
  try {
    await stream.write(data)
    await stream.close()
  } catch (error) {
    // Discard the temporary write without hiding the original failure if the
    // stream has already errored and aborting also rejects.
    await stream.abort(error).catch(() => undefined)
    throw error
  }
}

/** An entry that already exists where a new one was asked for. */
export class EntryExistsError extends Error {}

/** Creates an empty file or folder `name` in the folder at `parent`. */
export async function createEntry(
  root: FileSystemDirectoryHandle,
  parent: string,
  name: string,
  kind: EntryKind,
) {
  const directory = await directoryAt(root, parent)
  if (await exists(directory, name)) throw new EntryExistsError(name)
  const handle =
    kind === 'file'
      ? await directory.getFileHandle(name, { create: true })
      : await directory.getDirectoryHandle(name, { create: true })
  const entry: DiskEntry = { name, path: joinPath(parent, name), kind, handle }
  return entry
}

/** Deletes a file, or a folder and everything in it. */
export async function removeEntry(
  root: FileSystemDirectoryHandle,
  path: string,
  kind: EntryKind,
) {
  const directory = await directoryAt(root, parentPath(path))
  await directory.removeEntry(baseName(path), {
    recursive: kind === 'directory',
  })
}

type Movable = FileSystemHandle & { move?: (name: string) => Promise<void> }

async function copyInto(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
) {
  for await (const handle of source.values()) {
    if (handle.kind === 'file') {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const copy = await target.getFileHandle(handle.name, { create: true })
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await writeFile(copy, await handle.getFile())
    } else {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const copy = await target.getDirectoryHandle(handle.name, {
        create: true,
      })
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await copyInto(handle, copy)
    }
  }
}

/**
 * Renames a file or folder in place and returns its new path. Browsers that
 * can't move entries get a copy under the new name, then lose the old one.
 */
export async function renameEntry(
  root: FileSystemDirectoryHandle,
  entry: Pick<DiskEntry, 'path' | 'kind' | 'handle'>,
  name: string,
) {
  const parent = parentPath(entry.path)
  const path = joinPath(parent, name)
  if (path === entry.path) return path
  const directory = await directoryAt(root, parent)
  // A change of case alone names the same entry on most systems.
  const sameEntry = baseName(entry.path).toLowerCase() === name.toLowerCase()
  if (!sameEntry && (await exists(directory, name)))
    throw new EntryExistsError(name)
  const { move } = entry.handle as Movable
  if (move) {
    try {
      await move.call(entry.handle, name)
      return path
    } catch (error) {
      // Some versions only move files in the browser's private storage.
      if (
        !(error instanceof DOMException) ||
        error.name !== 'NotSupportedError'
      )
        throw error
    }
  }
  if (sameEntry) throw new EntryExistsError(name)
  if (entry.kind === 'file') {
    const file = await (entry.handle as FileSystemFileHandle).getFile()
    const copy = await directory.getFileHandle(name, { create: true })
    await writeFile(copy, file)
  } else {
    const copy = await directory.getDirectoryHandle(name, { create: true })
    await copyInto(entry.handle as FileSystemDirectoryHandle, copy)
  }
  await directory.removeEntry(baseName(entry.path), {
    recursive: entry.kind === 'directory',
  })
  return path
}
