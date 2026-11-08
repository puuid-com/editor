import { queryOptions } from '@tanstack/react-query'

import { listDirectory, listFiles } from '#/lib/disk-tree'
import type { DiskRoot } from '#/lib/store/disk'
import { readVault } from '#/lib/obsidian'

// What the explorer and the Markdown preview read from folders opened from
// disk. Each is read again when the page regains focus, so changes made in
// other apps show up; refreshing a folder reads all of its own again.

export const diskKeys = {
  root: (rootId: string) => ['disk', rootId] as const,
}

const fresh = { staleTime: 0 } as const

export const directoryQuery = (root: DiskRoot, path: string) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'directory', path],
    queryFn: () => listDirectory(root.handle, path),
    ...fresh,
  })

/** The files search looks through. */
export const filesQuery = (root: DiskRoot) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'files'],
    queryFn: () => listFiles(root.handle),
    ...fresh,
  })

/** Every file, the editor's or not, for the links and images in notes. */
export const allFilesQuery = (root: DiskRoot) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'all-files'],
    queryFn: () => listFiles(root.handle, { all: true, limit: Infinity }),
    ...fresh,
  })

/** The folder's Obsidian vault settings, or null when it isn't one. */
export const vaultQuery = (root: DiskRoot) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'vault'],
    queryFn: () => readVault(root.handle),
    ...fresh,
  })

/** A file's contents, kept as they were while unchanged so an image doesn't reload. */
export const blobQuery = (
  root: DiskRoot,
  path: string,
  handle: FileSystemFileHandle,
) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'blob', path],
    queryFn: () => handle.getFile(),
    structuralSharing: (previous: unknown, next: unknown) => {
      const before = previous as File | undefined
      const after = next as File
      return before?.lastModified === after.lastModified &&
        before.size === after.size
        ? before
        : after
    },
    ...fresh,
  })

/** A note's text, for `![[embeds]]` of it in other notes. */
export const textQuery = (
  root: DiskRoot,
  path: string,
  handle: FileSystemFileHandle,
) =>
  queryOptions({
    queryKey: [...diskKeys.root(root.id), 'text', path],
    queryFn: async () => (await handle.getFile()).text(),
    ...fresh,
  })
