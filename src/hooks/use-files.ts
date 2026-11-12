import {
  coalesce,
  eq,
  isNull,
  length,
  not,
  useLiveQuery,
} from '@tanstack/react-db'

import { filesCollection } from '#/lib/store/files'

/**
 * Every file not deleted, in tab order, without content so typing doesn't
 * re-render what lists them. The explorer shows them all; `closed` ones have
 * no tab.
 */
export function useWorkspaceFiles() {
  const { data } = useLiveQuery((q) =>
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
  )
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
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => eq(file.id, id ?? ''))
        .select(({ file }) => ({ empty: eq(length(file.content), 0) })),
  })
  return data.at(0)?.empty ?? false
}

/** Recently deleted files, newest first; content stays out of the rendered list. */
export function useArchivedFiles() {
  const { data } = useLiveQuery((q) =>
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
  )
  return data
}

/** One file's name, content and place on disk, kept current as they change. */
export function useFileContent(id: string) {
  const { data } = useLiveQuery({
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
