import { isNull, useLiveQuery } from '@tanstack/react-db'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useQueries } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { IconLetterCase } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import SearchWorker from './file-search.worker?worker'
import { FILE_LIMIT, TOTAL_LIMIT } from './file-search'
import type {
  FileMatch,
  SearchFile,
  SearchReply,
  SearchSources,
} from './file-search'
import { diskSearchId, searchFolderQuery } from './search-folders'
import type { FolderContents } from './search-folders'
import { openDiskFile } from './disk-workspace'
import { fileAtPath } from '#/lib/disk-tree'
import { isExcluded } from '#/lib/obsidian'
import { diskRoot, rootsStore } from '#/lib/store/disk'
import { folderPath } from '#/lib/store/folders'
import { FileIcon } from './FileIcon'
import { notify } from './notice-store'
import { setSettingsActive } from './settings-tab'
import { setCompareId } from './ui-store'
import { focusFileView } from '#/components/editor/editor-store'
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
import { fileAt, filesCollection, isOpen, reopenFile } from '#/lib/store/files'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

/** The editor receives the selection after the palette releases focus, even when it has to mount first. */
export async function openSearchMatch(hit: FileMatch) {
  let fileId = hit.fileId
  try {
    if (hit.location) {
      const { rootId, path } = hit.location
      const open = fileAt(rootId, path)
      if (open) fileId = open.id
      else {
        const root = diskRoot(rootId)
        if (!root || root.access !== 'granted') {
          notify.info(m.find_match_changed())
          return
        }
        const handle = await fileAtPath(root.handle, path)
        const id = await openDiskFile(root, {
          name: handle.name,
          path,
          kind: 'file',
          handle,
        })
        if (!id) return
        fileId = id
      }
    } else {
      await reopenFile(fileId)
    }
    if (!isOpen(filesCollection.get(fileId))) {
      notify.info(m.find_match_changed())
      return
    }
  } catch {
    notify.info(m.find_match_changed())
    return
  }
  setSettingsActive(false)
  setCompareId(null)
  setActive(fileId)
  // A view hidden behind Settings or a comparison can already be registered.
  // Let the pane reveal it before trying to focus it.
  requestAnimationFrame(() => {
    if (sessionStore.state.activeId !== fileId) return
    focusFileView(fileId, (view) => {
      const to = hit.from + hit.text.length
      if (
        to > view.state.doc.length ||
        view.state.sliceDoc(hit.from, to) !== hit.text
      ) {
        notify.info(m.find_match_changed())
        return
      }
      view.dispatch({
        selection: { anchor: hit.from, head: to },
        scrollIntoView: true,
        userEvent: 'select.search',
      })
    })
  })
}

function combineFolders(queries: Array<UseQueryResult<FolderContents>>) {
  return {
    contents: queries.flatMap((q) => (q.data ? [q.data] : [])),
    pending: queries.some((q) => q.isFetching),
    skipped: queries.some((q) => q.isError || q.data?.skipped),
  }
}

function useFileSearch(
  sources: SearchSources,
  query: string,
  matchCase: boolean,
) {
  const worker = useRef<Worker | null>(null)
  const [reply, setReply] = useState<
    (SearchReply & { sources: SearchSources }) | null
  >(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    // Send the text once per snapshot. Keystrokes send only the search terms.
    let search: Worker
    try {
      search = new SearchWorker()
    } catch {
      setFailed(true)
      return
    }
    worker.current = search
    search.onmessage = ({ data }: MessageEvent<SearchReply>) => {
      setFailed(false)
      setReply({ ...data, sources })
    }
    search.onerror = () => setFailed(true)
    search.postMessage(sources)
    return () => {
      search.terminate()
      worker.current = null
    }
  }, [sources])
  useEffect(() => {
    worker.current?.postMessage({ query, matchCase })
  }, [sources, query, matchCase])
  return {
    failed,
    reply:
      reply?.sources === sources &&
      reply.query === query &&
      reply.matchCase === matchCase
        ? reply
        : null,
  }
}

export function FindInFiles({
  onSelect,
}: {
  onSelect: (match: FileMatch) => void
}) {
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [debounced] = useDebouncedValue(query, { wait: 150 })
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
  const sources = useMemo(() => {
    const live = new Set<string>()
    const files: Array<SearchFile> = []
    for (const row of rows) {
      let name = row.name
      if (row.location) {
        const { rootId, path } = row.location
        live.add(diskSearchId(row.location))
        const folder = folders.contents.find((item) => item.rootId === rootId)
        const root = roots.find((item) => item.id === rootId)
        // Wait for a connected vault's exclusions before showing its open files.
        if (
          (root?.access === 'granted' && !folder) ||
          isExcluded(folder?.vault ?? null, path)
        )
          continue
        name = root ? `${root.name}/${path}` : path
      } else if (row.folderId) {
        name = [folderPath(row.folderId), row.name].filter(Boolean).join('/')
      }
      if (imageMime(row.name) || isImageData(row.content)) continue
      files.push({ id: row.id, name, content: row.content })
    }
    const disk = folders.contents.flatMap((folder) =>
      folder.files.filter((file) => !live.has(file.id)),
    )
    return { files, disk }
  }, [rows, roots, folders.contents])
  const { reply, failed } = useFileSearch(sources, debounced, matchCase)
  const current = query === debounced && query ? reply : null
  const results = current?.results
  const pending = !current || current.pending || folders.pending
  const skipped =
    current?.skipped ||
    folders.skipped ||
    roots.some((root) => root.access !== 'granted')
  const message = failed
    ? m.find_failed()
    : !query
      ? m.find_hint()
      : !results?.groups.length
        ? pending
          ? m.find_searching()
          : m.find_empty()
        : null
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
          <CommandGroup
            key={group.id}
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
