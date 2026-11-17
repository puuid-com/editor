import { and, coalesce, eq, isNull, useLiveQuery } from '@tanstack/react-db'
import { IconLetterCase } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import SearchWorker from './file-search.worker?worker'
import { FILE_LIMIT, TOTAL_LIMIT } from './file-search'
import type { FileMatch, SearchFile, SearchResults } from './file-search'
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
import { filesCollection, isOpen } from '#/lib/store/files'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

/** The editor receives the selection after the palette releases focus, even when it has to mount first. */
export function openSearchMatch(hit: FileMatch) {
  if (!isOpen(filesCollection.get(hit.fileId))) {
    notify.info(m.find_match_changed())
    return
  }
  setSettingsActive(false)
  setCompareId(null)
  setActive(hit.fileId)
  // A view hidden behind Settings or a comparison can already be registered.
  // Let the pane reveal it before trying to focus it.
  requestAnimationFrame(() => {
    if (sessionStore.state.activeId !== hit.fileId) return
    focusFileView(hit.fileId, (view) => {
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

interface Reply {
  query: string
  matchCase: boolean
  results: SearchResults
}

function useFileSearch(
  files: Array<SearchFile>,
  query: string,
  matchCase: boolean,
) {
  const worker = useRef<Worker | null>(null)
  const [reply, setReply] = useState<
    (Reply & { files: Array<SearchFile> }) | null
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
    search.onmessage = ({ data }: MessageEvent<Reply>) => {
      setFailed(false)
      setReply({ ...data, files })
    }
    search.onerror = () => setFailed(true)
    search.postMessage({
      files: files.filter((f) => !imageMime(f.name) && !isImageData(f.content)),
    })
    return () => {
      search.terminate()
      worker.current = null
    }
  }, [files])
  useEffect(() => {
    if (!query) return
    const timer = setTimeout(
      () => worker.current?.postMessage({ query, matchCase }),
      80,
    )
    return () => clearTimeout(timer)
  }, [files, query, matchCase])
  return {
    failed,
    results:
      reply?.files === files &&
      reply.query === query &&
      reply.matchCase === matchCase
        ? reply.results
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
  // The collection includes optimistic edits in every pane before they reach disk.
  const { data: files } = useLiveQuery({
    queryKey: ['find-in-open-files'],
    query: (q) =>
      q
        .from({ file: filesCollection })
        .where(({ file }) =>
          and(isNull(file.deletedAt), eq(coalesce(file.closed, false), false)),
        )
        .orderBy(({ file }) => file.order, 'asc')
        .select(({ file }) => ({
          id: file.id,
          name: file.name,
          content: file.content,
        })),
  })
  const { results, failed } = useFileSearch(files, query, matchCase)
  const message = failed
    ? m.find_failed()
    : !query
      ? m.find_hint()
      : !results
        ? m.find_searching()
        : !results.groups.length
          ? m.find_empty()
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
            heading={
              <span className="flex min-w-0 items-center gap-2 [&_svg]:size-3.5">
                <FileIcon file={{ name: group.name, empty: false }} />
                <span className="truncate">{group.name}</span>
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
