import { isNull, useLiveQuery } from '@tanstack/react-db'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useQueries } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { IconLetterCase } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import { useFileSearch } from './use-file-search'
import { FILE_LIMIT, TOTAL_LIMIT } from './file-search'
import type {
  FileMatch,
  SearchFile,
  SearchResults,
  SearchSources,
} from './file-search'
import { diskSearchId, searchFolderQuery } from './search-folders'
import type { FolderContents } from './search-folders'
import { isExcluded } from '#/lib/obsidian'
import { rootsStore } from '#/lib/store/disk'
import type { DiskRoot } from '#/lib/store/disk'
import { folderPath } from '#/lib/store/folders'
import { FileIcon } from './FileIcon'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Kbd } from '#/components/ui/kbd'
import { Toggle } from '#/components/ui/toggle'
import { imageMime, isImageData } from '#/lib/image-file'
import { filesCollection } from '#/lib/store/files'
import type { FileLocation, XmlFile } from '#/lib/store/files'
import { m } from '#/paraglide/messages'

function combineFolders(queries: Array<UseQueryResult<FolderContents>>) {
  return {
    contents: queries.flatMap((q) => (q.data ? [q.data] : [])),
    pending: queries.some((q) => q.isFetching),
    skipped: queries.some((q) => q.isError || q.data?.skipped),
  }
}

export function FindInFiles({
  onSelect,
}: {
  onSelect: (match: FileMatch) => void
}) {
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [debounced] = useDebouncedValue(query, { wait: 500 })
  const roots = useSelector(rootsStore, (state) => state)
  const folders = useQueries({
    queries: roots
      .filter((root) => root.access === 'granted')
      .map((root) => ({
        ...searchFolderQuery(root),
        enabled: !!debounced,
      })),
    combine: combineFolders,
  })
  // Includes closed browser files and the latest edits in disk-backed tabs.
  const { data: rows } = useLiveQuery({
    queryKey: ['workspace-search-files'],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) => isNull(file.deletedAt))
        .orderBy(({ file }) => file.order, 'asc')
        .select(({ file }) => ({
          id: file.id,
          name: file.name,
          folderId: file.folderId,
          content: file.content,
          location: file.location,
        })),
  })
  const sources = useMemo(
    () => searchSources(rows, roots, folders.contents),
    [rows, roots, folders.contents],
  )
  const { reply, failed } = useFileSearch(sources, debounced, matchCase)
  const current = query === debounced && query ? reply : null
  const results = current?.results
  const pending = !current || current.pending || folders.pending
  const skipped =
    current?.skipped ||
    folders.skipped ||
    roots.some((root) => root.access !== 'granted')
  const message = statusMessage(
    failed,
    query,
    !!results?.groups.length,
    pending,
  )
  return (
    <Command shouldFilter={false} label={m.find_in_files()} loop>
      <div className="relative">
        <p className="px-3 pt-3 pr-14 text-xs font-medium">
          {m.find_in_files()}
        </p>
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={m.find_placeholder()}
          aria-label={m.find_placeholder()}
        />
        <Toggle
          size="sm"
          className="absolute top-1.5 right-2"
          pressed={matchCase}
          onPressedChange={setMatchCase}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
          aria-label={m.find_match_case()}
          title={m.find_match_case()}
        >
          <IconLetterCase />
        </Toggle>
      </div>
      <CommandList className="h-[min(22rem,48dvh)] max-h-none">
        {message && (
          <p
            role="status"
            className="px-4 py-6 text-center text-xs text-muted-foreground"
          >
            {message}
          </p>
        )}
        {results?.groups.map((group) => (
          <ResultGroup key={group.id} group={group} onSelect={onSelect} />
        ))}
        {query && !failed && pending && !!results?.groups.length && (
          <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
            {m.find_searching()}
          </p>
        )}
        {query && skipped && (
          <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
            {m.find_skipped()}
          </p>
        )}
        {results?.limited && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {m.find_limit({ perFile: FILE_LIMIT, total: TOTAL_LIMIT })}
          </p>
        )}
      </CommandList>
      <div className="flex items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {m.palette_hint_navigate()}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          {m.notice_go_to()}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>Esc</Kbd>
          {m.palette_hint_close()}
        </span>
      </div>
    </Command>
  )
}

type SearchGroup = SearchResults['groups'][number]
type SearchRow = Pick<
  XmlFile,
  'id' | 'name' | 'folderId' | 'content' | 'location'
>

/** The files to search: browser files by folder path, open disk tabs with their edits, and the rest of each folder. */
function searchSources(
  rows: ReadonlyArray<SearchRow>,
  roots: ReadonlyArray<DiskRoot>,
  contents: ReadonlyArray<FolderContents>,
): SearchSources {
  const live = new Set<string>()
  const files: Array<SearchFile> = []
  const folderByRoot = new Map(contents.map((item) => [item.rootId, item]))
  const rootById = new Map(roots.map((item) => [item.id, item]))
  for (const row of rows) {
    if (row.location) live.add(diskSearchId(row.location))
    if (imageMime(row.name) || isImageData(row.content)) continue
    const name = row.location
      ? diskName(row.location, rootById, folderByRoot)
      : row.folderId
        ? [folderPath(row.folderId), row.name].filter(Boolean).join('/')
        : row.name
    if (name !== null) files.push({ id: row.id, name, content: row.content })
  }
  const disk = contents.flatMap((folder) =>
    folder.files.filter((file) => !live.has(file.id)),
  )
  return { files, disk }
}

/** A disk tab's name under its folder, or null while it shouldn't show. */
function diskName(
  { rootId, path }: FileLocation,
  rootById: ReadonlyMap<string, DiskRoot>,
  folderByRoot: ReadonlyMap<string, FolderContents>,
) {
  const folder = folderByRoot.get(rootId)
  const root = rootById.get(rootId)
  // Wait for a connected vault's exclusions before showing its open files.
  if (
    (root?.access === 'granted' && !folder) ||
    isExcluded(folder?.vault ?? null, path)
  )
    return null
  return root ? `${root.name}/${path}` : path
}

function statusMessage(
  failed: boolean,
  query: string,
  found: boolean,
  pending: boolean,
) {
  if (failed) return m.find_failed()
  if (!query) return m.find_hint()
  if (found) return null
  return pending ? m.find_searching() : m.find_empty()
}

/** One file's matches, under its name. */
function ResultGroup({
  group,
  onSelect,
}: {
  group: SearchGroup
  onSelect: (match: FileMatch) => void
}) {
  return (
    <CommandGroup
      value={group.id}
      heading={
        <span className="flex min-w-0 items-center gap-2 [&_svg]:size-3.5">
          <FileIcon file={{ name: group.name, empty: false }} />
          <span title={group.name} className="truncate">
            {group.name}
          </span>
        </span>
      }
    >
      {group.hits.map((hit) => (
        <CommandItem
          key={hit.from}
          value={`${group.id}:${hit.from}`}
          onSelect={() => onSelect(hit)}
          className="gap-3 py-1.5 font-mono [&>svg]:hidden"
        >
          <span
            className="min-w-8 shrink-0 text-right text-muted-foreground tabular-nums"
            aria-label={m.find_line({ line: hit.line })}
          >
            {hit.line}
          </span>
          <span className="truncate whitespace-pre">
            {hit.before}
            <mark className="search-hit">{hit.text}</mark>
            {hit.after}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
