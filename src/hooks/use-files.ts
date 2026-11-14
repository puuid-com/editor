import {
  coalesce,
  eq,
  isNull,
  length,
  not,
  useLiveQuery,
} from '@tanstack/react-db'

import { languageOf } from '#/lib/document'
import { imageMime, isImageData } from '#/lib/image-file'
import { filesCollection } from '#/lib/store/files'

// Each query names its identity with `queryKey`, so a render doesn't rebuild
// and hash the query to find out it is the same one. A key holds every value
// its query reads from the component.

/**
 * Every file not deleted, in tab order, without content so typing doesn't
 * re-render what lists them. The explorer shows them all; `closed` ones have
 * no tab.
 */
export function useWorkspaceFiles() {
  const { data } = useLiveQuery({
    queryKey: ['workspace-files'],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => isNull(file.deletedAt))
        .orderBy(({ file }) => file.order, 'asc')
        .select(({ file }) => ({
          id: file.id,
          name: file.name,
          folderId: file.folderId,
          order: file.order,
          profileId: file.profileId,
          location: file.location,
          // Files stored before tabs could close have no flag.
          closed: coalesce(file.closed, false),
          // An empty file has no type until something is pasted or typed.
          empty: eq(length(file.content), 0),
        })),
  })
  return data
}

export type WorkspaceFile = ReturnType<typeof useWorkspaceFiles>[number]

/** The files with a tab, in tab order. */
export function openFiles(files: ReadonlyArray<WorkspaceFile>) {
  return files.filter((file) => !file.closed)
}

/** Tabs in order. The editor screen reads them once and hands them down. */
export function useOpenFiles() {
  return openFiles(useWorkspaceFiles())
}

/** Whether a file has no content, and so no type or structure yet. */
export function useFileEmpty(id: string | null) {
  const fileId = id ?? ''
  const { data } = useLiveQuery({
    queryKey: ['file-empty', fileId],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => eq(file.id, fileId))
        .select(({ file }) => ({ empty: eq(length(file.content), 0) })),
  })
  return data.at(0)?.empty ?? false
}

/**
 * What a pane shows a file as: its name, type, whether it is an image and
 * whether it has any content. Typing rarely changes these, so the pane
 * isn't rendered again for every key as it would be reading the content.
 */
export function useFileKind(id: string) {
  const { data } = useLiveQuery({
    queryKey: ['file-kind', id],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => eq(file.id, id))
        .fn.select(({ file }) => ({
          name: file.name,
          language: languageOf(file.name, file.content),
          image: !!imageMime(file.name) || isImageData(file.content),
          hasContent: file.content.length > 0,
        })),
  })
  return data.at(0) ?? null
}

/** Recently deleted files, newest first; content stays out of the rendered list. */
export function useArchivedFiles() {
  const { data } = useLiveQuery({
    queryKey: ['archived-files'],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => not(isNull(file.deletedAt)))
        .orderBy(({ file }) => file.deletedAt, 'desc')
        .orderBy(({ file }) => file.id, 'asc')
        .select(({ file }) => ({
          id: file.id,
          name: file.name,
          deletedAt: file.deletedAt,
        })),
  })
  return data
}

/** One file's name, content and place on disk, kept current as they change. */
export function useFileContent(id: string) {
  const { data } = useLiveQuery({
    queryKey: ['file-content', id],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => eq(file.id, id))
        .select(({ file }) => ({
          name: file.name,
          content: file.content,
          location: file.location,
        })),
  })
  return data.at(0) ?? null
}
