import { IconPlus } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { FILE_TYPES, canReadAs, setFileType, useFileType } from './file-type'
import { MAX_PANES, joinPanes, moveTab, openBeside } from './panes'
import { newFile } from './files'
import { TabClose } from './TabClose'
import { TabList } from './TabList'
import { ToolbarButton } from './ToolbarButton'
import { closeTab, askRename, uiStore } from './ui-store'
import { UnsavedMark } from './UnsavedMark'
import { focusFileView } from '#/components/editor/editor-store'
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

// Tabs fit their name, within bounds, however many are open. Each is a flat
// pill on the pane's header; the active one is filled, fainter in a pane that
// doesn't have the focus. When they don't fit, the strip scrolls, fades at
// the edge that has more, and the full list sits behind a menu at its end.

/** What a dragged tab carries: its file's id. */
const TAB_DRAG = 'text/x-xml-tab'

/** Fades the strip's edges that hide more tabs. */
function edgeMask(start: boolean, end: boolean) {
  if (!start && !end) return undefined
  const mask = `linear-gradient(to right, ${start ? 'transparent' : '#000'}, #000 2rem, #000 calc(100% - 2rem), ${end ? 'transparent' : '#000'})`
  return { maskImage: mask, WebkitMaskImage: mask }
}

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
  // Focus that came from a press. Chrome can count it as keyboard focus
  // after typing, so the focus outline waits for a key in the strip.
  const [pressed, setPressed] = useState(false)
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

  return (
    <div
      className="flex h-full min-w-0 flex-1 items-stretch"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TAB_DRAG)) e.preventDefault()
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TAB_DRAG)
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        moveTab(id, paneId)
        setOverId(null)
      }}
    >
      <Tabs
        value={activeId ?? ''}
        onValueChange={setActive}
        className="min-w-0 flex-initial gap-0"
      >
        <TabsList
          ref={stripRef}
          variant="line"
          aria-label={m.tabs_label()}
          style={edgeMask(edges.start, edges.end)}
          onPointerDown={() => setPressed(true)}
          onKeyDown={() => setPressed(false)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPressed(false)
          }}
          className="relative h-full! w-full items-center justify-start gap-0.5 overflow-x-auto p-0 [scrollbar-width:none]"
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
                      e.dataTransfer.setData(TAB_DRAG, file.id)
                    }}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes(TAB_DRAG)) return
                      e.preventDefault()
                      setOverId(file.id)
                    }}
                    onDragLeave={() => setOverId(null)}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes(TAB_DRAG)) return
                      e.preventDefault()
                      e.stopPropagation()
                      const id = e.dataTransfer.getData(TAB_DRAG)
                      if (id) moveTab(id, paneId, file.id)
                      setOverId(null)
                    }}
                    onDragEnd={() => {
                      setOverId(null)
                    }}
                    data-active={file.id === activeId || undefined}
                    className={cn(
                      'group/tab relative flex h-9 max-w-56 min-w-0 shrink-0 items-center rounded-md pr-1.5 md:h-7',
                      // Keyboard focus outlines the whole tab, not the name.
                      !pressed &&
                        'has-[[role=tab]:focus-visible]:outline-2 has-[[role=tab]:focus-visible]:-outline-offset-2 has-[[role=tab]:focus-visible]:outline-ring',
                      file.id !== activeId
                        ? 'hover:bg-muted/70'
                        : focused
                          ? 'bg-muted'
                          : 'bg-muted/60',
                      overId === file.id &&
                        'shadow-[inset_2px_0_0_var(--ring)]',
                    )}
                  >
                    <TabsTrigger
                      value={file.id}
                      // A click hands focus to the file's editor, like VS
                      // Code, so later keys don't land on the tab.
                      onClick={() => focusFileView(file.id)}
                      onDoubleClick={() => askRename(file.id)}
                      onAuxClick={(e) => {
                        if (e.button === 1) closeTab(file.id)
                      }}
                      className="h-full! min-w-0 flex-1 justify-start gap-2 pr-1 pl-2.5 font-normal after:hidden focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-active:font-medium"
                    >
                      {profile && !file.empty && (
                        <span
                          style={hlStyle(profileCss(profile))}
                          className="size-2 shrink-0 rounded-full bg-(--hl)"
                        />
                      )}
                      <span className="truncate">{file.name}</span>
                      {profile && !file.empty && (
                        <span className="sr-only">
                          {` (${m.profile_label({ name: profile.name })})`}
                        </span>
                      )}
                      <UnsavedMark fileId={file.id} srOnly />
                    </TabsTrigger>
                    <TabClose file={file} active={file.id === activeId} />
                  </div>
                </ContextMenuTrigger>
                <TabContextMenu files={files} index={index} paneId={paneId} />
              </ContextMenu>
            )
          })}
        </TabsList>
      </Tabs>
      <div className="flex shrink-0 items-center gap-0.5 pl-0.5">
        <ToolbarButton
          label={m.file_new()}
          shortcut={shortcuts.newFile}
          size="icon-sm"
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
      {panes.length > 1 && (
        <ContextMenuItem onSelect={joinPanes}>{m.pane_join()}</ContextMenuItem>
      )}
      <TypeSubMenu file={file} />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => closeTab(file.id)}>
        {m.tabs_close()}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!others.length}
        onSelect={() => closeTab(others)}
      >
        {m.tabs_close_others()}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!right.length}
        onSelect={() => closeTab(right)}
      >
        {m.tabs_close_right()}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => closeTab(files.map((f) => f.id))}>
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
