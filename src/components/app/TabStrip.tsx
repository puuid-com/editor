import {
  IconChevronLeft,
  IconChevronRight,
  IconFileCode,
  IconFileDots,
  IconPlus,
  IconX,
} from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { FILE_TYPES, canReadAs, setFileType, useFileType } from './file-type'
import { MAX_PANES, moveTab, openBeside } from './panes'
import { newFile } from './files'
import { TabList } from './TabList'
import { ToolbarButton } from './ToolbarButton'
import { askClose, askRename, uiStore } from './ui-store'
import { UnsavedMark } from './UnsavedMark'
import { hlStyle } from '#/components/highlights/hl-style'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useProfiles } from '#/hooks/use-profiles'
import { useScrollEdges } from '#/hooks/use-scroll-edges'
import { shortcuts } from '#/lib/shortcuts'
import { profileCss, resolveProfile } from '#/lib/store/profiles'
import { sessionStore, setActive } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { TabFile } from './files'
import type { DocLanguage } from '#/lib/document'

// Tabs fit their name, within bounds, however many are open. When they don't
// fit, the strip scrolls and the full list sits behind a menu at its end.

export function TabStrip({
  files,
  activeId,
  paneId,
  focused = true,
}: {
  files: Array<TabFile>
  activeId: string | null
  paneId: string
  focused?: boolean
}) {
  const profiles = useProfiles()
  const [overId, setOverId] = useState<string | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const edges = useScrollEdges(stripRef)
  const listOpen = useSelector(uiStore, (s) => s.tabListOpen) && focused
  const overflowing = edges.start || edges.end

  // Bring the active tab into view, with a sliver of its neighbours.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip || !activeId) return
    const tab = [...strip.querySelectorAll<HTMLElement>('[data-tab-id]')].find(
      (el) => el.dataset.tabId === activeId,
    )
    if (!tab) return
    const peek = 32
    const left = tab.offsetLeft - peek
    const right = tab.offsetLeft + tab.offsetWidth + peek - strip.clientWidth
    if (strip.scrollLeft > left) strip.scrollLeft = left
    else if (strip.scrollLeft < right) strip.scrollLeft = right
  }, [activeId, files.length])

  const scrollBy = (direction: number) => {
    const strip = stripRef.current
    if (strip) strip.scrollLeft += direction * strip.clientWidth * 0.8
  }

  return (
    <div
      className="flex h-full min-w-0 flex-1 items-stretch"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-xml-tab')) e.preventDefault()
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/x-xml-tab')
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        moveTab(id, paneId)
        setOverId(null)
      }}
    >
      {overflowing && (
        <ToolbarButton
          label={m.tabs_scroll_left()}
          disabled={!edges.start}
          className="ml-1 shrink-0 self-center"
          onClick={() => scrollBy(-1)}
        >
          <IconChevronLeft />
        </ToolbarButton>
      )}
      <Tabs
        value={activeId ?? ''}
        onValueChange={setActive}
        className="min-w-0 flex-initial gap-0"
      >
        <TabsList
          ref={stripRef}
          variant="line"
          aria-label={m.tabs_label()}
          className="relative h-full! w-full items-end justify-start gap-0 overflow-x-auto px-2 py-0 [scrollbar-width:none]"
        >
          {files.map((file, index) => {
            const profile = resolveProfile(profiles, file.profileId)
            return (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger asChild>
                  <div
                    draggable
                    data-tab-id={file.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/x-xml-tab', file.id)
                    }}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes('text/x-xml-tab'))
                        return
                      e.preventDefault()
                      setOverId(file.id)
                    }}
                    onDragLeave={() => setOverId(null)}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes('text/x-xml-tab'))
                        return
                      e.preventDefault()
                      e.stopPropagation()
                      const id = e.dataTransfer.getData('text/x-xml-tab')
                      if (id) moveTab(id, paneId, file.id)
                      setOverId(null)
                    }}
                    onDragEnd={() => {
                      setOverId(null)
                    }}
                    data-active={file.id === activeId || undefined}
                    className={cn(
                      'group/tab relative flex h-full max-w-60 min-w-24 shrink-0 items-stretch',
                      file.id === activeId
                        ? 'z-10 bg-background shadow-[inset_0_-2px_var(--foreground)]'
                        : 'hover:bg-foreground/5',
                      overId === file.id &&
                        'shadow-[inset_2px_0_0_var(--ring)]',
                    )}
                  >
                    <TabsTrigger
                      value={file.id}
                      onDoubleClick={() => askRename(file.id)}
                      onAuxClick={(e) => {
                        if (e.button === 1) askClose(file.id)
                      }}
                      className="h-full! min-w-0 flex-1 justify-start gap-2 pr-11 pl-3 font-normal after:hidden md:pr-8"
                    >
                      {file.empty ? (
                        <IconFileDots className="size-3.5! text-muted-foreground" />
                      ) : (
                        <IconFileCode className="size-3.5! text-muted-foreground" />
                      )}
                      {file.empty ? (
                        <span className="truncate">{file.name}</span>
                      ) : profile ? (
                        <span
                          style={hlStyle(profileCss(profile))}
                          className="hl-tag hl-ink min-w-0 truncate px-1 leading-5"
                        >
                          {file.name}
                          <span className="sr-only">
                            {` (${m.profile_label({ name: profile.name })})`}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate">{file.name}</span>
                      )}
                      <UnsavedMark fileId={file.id} />
                    </TabsTrigger>
                    <button
                      type="button"
                      aria-label={m.tab_close({ name: file.name })}
                      onClick={() => askClose(file.id)}
                      className={cn(
                        'absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:opacity-100 md:right-2 md:size-5 md:opacity-0 md:group-hover/tab:opacity-100',
                        file.id === activeId && 'md:opacity-100',
                      )}
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                </ContextMenuTrigger>
                <TabContextMenu files={files} index={index} paneId={paneId} />
              </ContextMenu>
            )
          })}
        </TabsList>
      </Tabs>
      {overflowing && (
        <ToolbarButton
          label={m.tabs_scroll_right()}
          disabled={!edges.end}
          className="shrink-0 self-center"
          onClick={() => scrollBy(1)}
        >
          <IconChevronRight />
        </ToolbarButton>
      )}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 px-1',
          overflowing && 'border-l',
        )}
      >
        <ToolbarButton
          label={m.file_new()}
          shortcut={shortcuts.newFile}
          size="icon-sm"
          className="rounded-full"
          onClick={newFile}
        >
          <IconPlus />
        </ToolbarButton>
        {(overflowing || listOpen) && (
          <TabList files={files} activeId={activeId} open={listOpen} />
        )}
      </div>
    </div>
  )
}

function TabContextMenu({
  files,
  index,
  paneId,
}: {
  files: Array<TabFile>
  index: number
  paneId: string
}) {
  const panes = useSelector(sessionStore, (s) => s.panes ?? [])
  const file = files[index]
  const others = files.filter((f) => f.id !== file.id).map((f) => f.id)
  const right = files.slice(index + 1).map((f) => f.id)

  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => askRename(file.id)}>
        {m.file_rename()}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={
          panes.length >= MAX_PANES ||
          (panes.find((p) => p.fileIds.includes(file.id))?.fileIds.length ??
            0) < 2
        }
        onSelect={() => openBeside(file.id)}
      >
        {m.pane_open()}
      </ContextMenuItem>
      {panes.map(
        (pane, paneIndex) =>
          pane.id !== paneId && (
            <ContextMenuItem
              key={pane.id}
              onSelect={() => moveTab(file.id, pane.id)}
            >
              {m.pane_move_to({ number: paneIndex + 1 })}
            </ContextMenuItem>
          ),
      )}
      <TypeSubMenu file={file} />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => askClose(file.id)}>
        {m.tabs_close()}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!others.length}
        onSelect={() => askClose(others)}
      >
        {m.tabs_close_others()}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!right.length}
        onSelect={() => askClose(right)}
      >
        {m.tabs_close_right()}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => askClose(files.map((f) => f.id))}>
        {m.tabs_close_all()}
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

/** Picks the file's type, empty files included. */
function TypeSubMenu({ file }: { file: TabFile }) {
  const type = useFileType(file.id)
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={!type}>
        {m.file_change_type()}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-40">
        <ContextMenuRadioGroup
          value={type?.language ?? ''}
          onValueChange={(value) =>
            void setFileType(file.id, value as DocLanguage)
          }
        >
          {FILE_TYPES.map((option) => (
            <ContextMenuRadioItem
              key={option.value}
              value={option.value}
              disabled={!type || !canReadAs(type.content, option.value)}
            >
              {option.label()}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}
