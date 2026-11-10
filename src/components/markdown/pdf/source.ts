import { getFileView } from '#/components/editor/editor-store'
import { fileIdField } from '#/components/editor/extensions'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { isWithin, listFiles } from '#/lib/disk-tree'
import { isMarkdownName } from '#/lib/obsidian'
import type { DiskRoot } from '#/lib/store/disk'
import { fileAt, filesCollection } from '#/lib/store/files'
import type { FileLocation, XmlFile } from '#/lib/store/files'
import {
  folderPath,
  foldersCollection,
  folderTreeIds,
} from '#/lib/store/folders'
import { m } from '#/paraglide/messages'

export type PdfSource =
  | { kind: 'file'; id: string }
  | { kind: 'folder'; id: string }
  | { kind: 'disk'; root: DiskRoot; path: string; directory: boolean }

export interface PdfNote {
  name: string
  path: string
  content: string
  location?: FileLocation
}

function currentNote(file: XmlFile): PdfNote {
  const view = getFileView(file.id)
  return {
    name: file.name,
    path:
      file.location?.path ??
      [folderPath(file.folderId), file.name].filter(Boolean).join('/'),
    content:
      view?.state.field(fileIdField, false) === file.id
        ? view.state.doc.toString()
        : file.content,
    location: file.location,
  }
}

/** Snapshot every note, including edits that have not reached disk yet. */
export async function collectPdfNotes(source: PdfSource) {
  let name: string
  let notes: Array<PdfNote>
  if (source.kind === 'file') {
    const file = filesCollection.get(source.id)
    if (!file || file.deletedAt !== null) throw new Error(m.md_pdf_empty())
    name = file.name.replace(/\.(md|markdown)$/i, '')
    notes = [currentNote(file)]
  } else if (source.kind === 'folder') {
    const folder = foldersCollection.get(source.id)
    if (!folder) throw new Error(m.md_pdf_empty())
    name = folder.name
    const ids = folderTreeIds(source.id)
    notes = [...filesCollection.values()]
      .filter(
        (file) =>
          file.deletedAt === null &&
          file.folderId &&
          ids.has(file.folderId) &&
          isMarkdownName(file.name),
      )
      .map(currentNote)
  } else {
    const { root, path, directory } = source
    const basename = path.split('/').at(-1) || root.name
    name = directory ? basename : basename.replace(/\.(md|markdown)$/i, '')
    // Export has no search-result cap: every descendant is included.
    const entries = await browserQueryClient().fetchQuery({
      queryKey: ['pdf-files', root.id],
      queryFn: () => listFiles(root.handle, { limit: Infinity, all: true }),
      staleTime: 0,
    })
    notes = await Promise.all(
      entries
        .filter(
          (entry) =>
            isMarkdownName(entry.name) &&
            (directory
              ? !path || isWithin(entry.path, path)
              : entry.path === path),
        )
        .map(async (entry): Promise<PdfNote> => {
          const open = fileAt(root.id, entry.path)
          if (open) return currentNote(open)
          return {
            name: entry.name,
            path: entry.path,
            content: await (
              await (entry.handle as FileSystemFileHandle).getFile()
            ).text(),
            location: { rootId: root.id, path: entry.path },
          }
        }),
    )
  }
  if (!notes.length) throw new Error(m.md_pdf_empty())
  notes.sort(
    (a, b) =>
      a.path.localeCompare(b.path, 'en', { numeric: true }) ||
      a.path.localeCompare(b.path, 'en'),
  )
  return { name, notes }
}
