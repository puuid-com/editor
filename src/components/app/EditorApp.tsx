import { IconFileUpload } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { FileExplorer } from './FileExplorer'
import {
  keepWorkspaceSafe,
  offerErasedBackup,
  reportSaveFailed,
} from './backup'
import { notify } from './notice-store'
import { reportLoadFailed } from './load-failed'
import { Dialogs } from './Dialogs'
import { startDiskSync } from './disk-workspace'
import {
  ACCEPTED_TYPES,
  canOpenFromDisk,
  dropFiles,
  importFiles,
  pickFromDisk,
} from './files'
import { settingsPane, settingsTab } from './settings-tab'
import { StatusBar } from './StatusBar'
import { useAppShortcuts } from './use-app-shortcuts'
import { endCompare, uiStore } from './ui-store'
import { DraftControls, DraftPane } from './DraftPane'
import { MixedWorkspace } from './MixedWorkspace'
import { editorPrefs } from '#/components/editor/word-wrap'
import {
  SidebarInset,
  SidebarProvider,
  sidebarDefaultOpen,
} from '#/components/ui/sidebar'
import { useEditorTitle } from '#/hooks/use-editor-title'
import { openFiles, useWorkspaceFiles } from '#/hooks/use-files'
import { useMediaQuery } from '#/hooks/use-media-query'
import { lazyPart, onLoadFailed, startPreloading } from '#/lib/lazy'
import { onUncaughtError, openRescue } from '#/lib/rescue/client'
import { onSaveFailed } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import type { FilePaneGroup } from '#/lib/store/pane-layout'
import type { TabFile } from './files'
import { m } from '#/paraglide/messages'

const SettingsSheet = lazyPart(() =>
  import('./on-demand').then((mod) => mod.SettingsSheet),
)

export function EditorApp() {
  // The one read of the files: everything below takes them from here.
  const workspaceFiles = useWorkspaceFiles()
  const files = openFiles(workspaceFiles)
  const panes = useSelector(sessionStore, (s) => s.panes)
  const sidebarRight = useSelector(editorPrefs, (s) => s.sidebarRight)
  const storedActive = useSelector(sessionStore, (s) => s.activeId)
  const wide = useMediaQuery('(min-width: 768px)')
  const settings = useSelector(settingsTab, (s) => s)
  const inputRef = useRef<HTMLInputElement>(null)
  const drop = useFileDrop()

  // Fall back to the first tab when the stored one is gone (closed here
  // or in another browser tab).
  const activeId = files.some((f) => f.id === storedActive)
    ? storedActive
    : (files.at(0)?.id ?? null)
  const activeName = files.find((file) => file.id === activeId)?.name
  useEditorTitle(activeName)
  useEffect(() => {
    // Unless another file was picked since this render: its own render
    // decides then.
    if (
      activeId !== storedActive &&
      sessionStore.state.activeId === storedActive
    )
      setActive(activeId)
  }, [activeId, storedActive])

  useWorkspaceServices(files.length > 0)
  const compareId = useCompareId(activeId, files)

  // Browsers that can write back to the file open it with a handle.
  const openFromDisk = () => {
    if (canOpenFromDisk()) void pickFromDisk()
    else inputRef.current?.click()
  }

  useAppShortcuts({
    activeId,
    fileIds:
      (wide && paneOfFile(panes, activeId)?.fileIds) || files.map((f) => f.id),
    onOpenFromDisk: openFromDisk,
  })

  // The bottom bar is about the focused file, so it empties while the
  // settings page covers that file.
  const settingsShown = settingsCover(settings, activeId, wide ? panes : [])

  return (
    <SidebarProvider
      // Tells the recovery screen the editor is up; see `rescue.ts`.
      data-app-ready
      defaultOpen={sidebarDefaultOpen()}
      // The sidebar stays first in the DOM so the sheet's peer styles see it.
      className={cn(
        'relative h-dvh overflow-hidden',
        sidebarRight && 'flex-row-reverse',
      )}
      {...drop.handlers}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <FileExplorer
        files={workspaceFiles}
        activeId={activeId}
        onImport={openFromDisk}
      />
      {/* The workspace sheet: panes above, the active file's bar below. */}
      <SidebarInset id="main" className="min-h-0 min-w-0 overflow-hidden">
        <div className="min-h-0 flex-1">
          {activeId ? (
            <MixedWorkspace
              files={files}
              fileId={activeId}
              compareId={compareId}
              wide={wide}
            />
          ) : (
            <NoFile settings={settings.open} />
          )}
        </div>
        <StatusBar
          settings={settingsShown}
          leading={!activeId && <DraftControls onOpenFromDisk={openFromDisk} />}
        />
      </SidebarInset>

      <Dialogs
        files={files}
        activeId={activeId}
        activeName={activeName}
        onOpenFromDisk={openFromDisk}
      />

      <div
        aria-hidden={!drop.dragging}
        className={cn(
          'pointer-events-none absolute inset-2 z-50 hidden place-items-center rounded-xl border-2 border-dashed border-ring bg-background/80',
          drop.dragging && 'grid',
        )}
      >
        <div className="flex flex-col items-center gap-2 text-sm">
          <IconFileUpload className="size-6" />
          {m.drop_files()}
        </div>
      </div>
    </SidebarProvider>
  )
}

/** With no file open: the settings page, or the draft to start one in. */
function NoFile({ settings }: { settings: boolean }) {
  return settings ? <SettingsSheet /> : <DraftPane />
}

/** What runs beside the editor for as long as it is open. */
function useWorkspaceServices(inUse: boolean) {
  useEffect(() => onSaveFailed(reportSaveFailed), [])
  useEffect(() => onLoadFailed(reportLoadFailed), [])
  useEffect(() => onUncaughtError(reportUncaught), [])
  // What was left out of the first load is fetched now that it has rendered.
  useEffect(() => startPreloading(), [])
  // Tabs of folders opened from disk save there as they're edited.
  useEffect(() => startDiskSync(), [])
  useEffect(() => {
    if (inUse) keepWorkspaceSafe()
  }, [inUse])
  // After the recovery screen erased everything, its backup is one click away.
  useEffect(() => void offerErasedBackup(), [])
}

/** An error nothing caught: said in the status bar, with the way to recover. */
function reportUncaught(message: string) {
  notify.error(m.rescue_unexpected(), {
    detail: message,
    action: { label: m.rescue_details(), run: () => openRescue() },
  })
}

/**
 * The tab the active one is compared with. A comparison belongs to the tab
 * it was opened for, ends when another tab is picked, and needs the other
 * tab to stay open.
 */
function useCompareId(activeId: string | null, files: Array<TabFile>) {
  const compare = useSelector(uiStore, (s) => s.compare)
  const compareId =
    compare &&
    compare.fileId === activeId &&
    compare.otherId !== activeId &&
    files.some((f) => f.id === compare.otherId)
      ? compare.otherId
      : null
  useEffect(() => {
    if (compare && !compareId) endCompare()
  }, [compare, compareId])
  return compareId
}

/** Files dropped anywhere on the editor open as tabs. */
function useFileDrop() {
  const [dragging, setDragging] = useState(false)
  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files')
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      dropFiles(e.dataTransfer)
    },
  }
  return { dragging, handlers }
}

function paneOfFile(
  panes: ReadonlyArray<FilePaneGroup> | undefined,
  fileId: string | null,
) {
  return panes?.find((p) => p.fileIds.includes(fileId ?? ''))
}

/** Whether the settings page covers the active file, or stands in for none. */
function settingsCover(
  settings: { open: boolean; active: boolean; paneId: string | null },
  activeId: string | null,
  panes: ReadonlyArray<FilePaneGroup> | undefined,
) {
  if (!settings.open) return false
  if (!activeId) return true
  if (!settings.active) return false
  if (!panes?.length) return true
  return !!settingsPane(settings.paneId, panes, activeId)?.fileIds.includes(
    activeId,
  )
}
