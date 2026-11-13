import { PdfExportDialog } from '#/components/markdown/pdf/PdfExportDialog'
import { IconFileUpload } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { FileExplorer } from './FileExplorer'
import { ArchiveDialog } from './ArchiveDialog'
import { keepWorkspaceSafe, reportSaveFailed } from './backup'
import { CommandMenu } from './CommandMenu'
import { startDiskSync } from './disk-workspace'
import { DefaultsConfirmDialog, VarsConfirmDialog } from './ChangesDialogs'
import { DeleteDialog } from './DeleteDialog'
import {
  ACCEPTED_TYPES,
  canOpenFromDisk,
  dropFiles,
  importFiles,
  pickFromDisk,
} from './files'
import { RenameDialog } from './RenameDialog'
import { RestoreDialog } from './RestoreDialog'
import { SettingsSheet } from './SettingsPage'
import { settingsPane, settingsTab } from './settings-tab'
import { OpenSharedDialog } from './OpenSharedDialog'
import { ShareLinkDialog } from './ShareDialog'
import { StatusBar } from './StatusBar'
import { useAppShortcuts } from './use-app-shortcuts'
import { VariableValueDialog } from './VariableValueDialog'
import { setCompareId, uiStore } from './ui-store'
import { DraftControls, DraftPane } from './DraftPane'
import { MixedWorkspace } from './MixedWorkspace'
import { editorPrefs } from '#/components/editor/word-wrap'
import { QuickHighlight } from '#/components/highlights/QuickHighlight'
import {
  DeleteProfileDialog,
  ProfileDialog,
} from '#/components/profiles/ProfileDialogs'
import {
  SidebarInset,
  SidebarProvider,
  sidebarDefaultOpen,
} from '#/components/ui/sidebar'
import { useEditorTitle } from '#/hooks/use-editor-title'
import { openFiles, useWorkspaceFiles } from '#/hooks/use-files'
import { useMediaQuery } from '#/hooks/use-media-query'
import { onSaveFailed } from '#/lib/store/persist'
import { sessionStore, setActive } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

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
  const [dragging, setDragging] = useState(false)

  // Fall back to the first tab when the stored one is gone (closed here
  // or in another browser tab).
  const activeId = files.some((f) => f.id === storedActive)
    ? storedActive
    : (files.at(0)?.id ?? null)
  const activeName = files.find((file) => file.id === activeId)?.name
  useEditorTitle(activeName)
  useEffect(() => {
    if (activeId !== storedActive) setActive(activeId)
  }, [activeId, storedActive])

  useEffect(() => onSaveFailed(reportSaveFailed), [])
  // Tabs of folders opened from disk save there as they're edited.
  useEffect(() => startDiskSync(), [])

  const inUse = files.length > 0
  useEffect(() => {
    if (inUse) keepWorkspaceSafe()
  }, [inUse])

  // A comparison belongs to the tab it was opened from, and needs the other
  // tab to stay open.
  const storedCompareId = useSelector(uiStore, (s) => s.compareId)
  const compareId =
    storedCompareId &&
    storedCompareId !== activeId &&
    files.some((f) => f.id === storedCompareId)
      ? storedCompareId
      : null
  useEffect(() => setCompareId(null), [activeId])
  useEffect(() => {
    if (storedCompareId && !compareId) setCompareId(null)
  }, [storedCompareId, compareId])

  // Browsers that can write back to the file open it with a handle.
  const openFromDisk = () => {
    if (canOpenFromDisk()) void pickFromDisk()
    else inputRef.current?.click()
  }

  useAppShortcuts({
    activeId,
    fileIds:
      (wide &&
        panes?.find((p) => p.fileIds.includes(activeId ?? ''))?.fileIds) ||
      files.map((f) => f.id),
    onOpenFromDisk: openFromDisk,
  })

  // The bottom bar is about the focused file, so it empties while the
  // settings page covers that file.
  const settingsShown =
    settings.open &&
    (!activeId ||
      (settings.active &&
        (!wide ||
          !panes?.length ||
          !!settingsPane(settings.paneId, panes, activeId)?.fileIds.includes(
            activeId,
          ))))

  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files')

  return (
    <SidebarProvider
      defaultOpen={sidebarDefaultOpen()}
      // The sidebar stays first in the DOM so the sheet's peer styles see it.
      className={cn(
        'relative h-dvh overflow-hidden',
        sidebarRight && 'flex-row-reverse',
      )}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragging(false)
        dropFiles(e.dataTransfer)
      }}
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
          ) : settings.open ? (
            <SettingsSheet />
          ) : (
            <DraftPane />
          )}
        </div>
        <StatusBar
          settings={settingsShown}
          leading={!activeId && <DraftControls onOpenFromDisk={openFromDisk} />}
        />
      </SidebarInset>

      <PdfExportDialog />
      <RenameDialog />
      <ArchiveDialog />
      <CommandMenu
        files={files}
        activeId={activeId}
        onOpenFromDisk={openFromDisk}
      />
      <DeleteDialog openIds={files.map((f) => f.id)} />
      <DefaultsConfirmDialog />
      <VarsConfirmDialog />
      <RestoreDialog />
      <VariableValueDialog />
      <ProfileDialog />
      <DeleteProfileDialog />
      <QuickHighlight />
      <ShareLinkDialog name={activeName} />
      <OpenSharedDialog />

      <div
        aria-hidden={!dragging}
        className={cn(
          'pointer-events-none absolute inset-2 z-50 hidden place-items-center rounded-xl border-2 border-dashed border-ring bg-background/80',
          dragging && 'grid',
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
