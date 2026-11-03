import { IconFileUpload } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef, useState } from 'react'

import { AppHeader } from './AppHeader'
import { ArchiveDialog } from './ArchiveDialog'
import { keepWorkspaceSafe, reportSaveFailed } from './backup'
import { CommandMenu } from './CommandMenu'
import { DefaultsConfirmDialog, VarsConfirmDialog } from './ChangesDialogs'
import { CloseDialog } from './CloseDialog'
import {
  ACCEPTED_TYPES,
  canOpenFromDisk,
  dropFiles,
  importFiles,
  pickFromDisk,
} from './files'
import { PasteDialog } from './PasteDialog'
import { RenameDialog } from './RenameDialog'
import { RestoreDialog } from './RestoreDialog'
import { OpenSharedDialog } from './OpenSharedDialog'
import { ShareLinkDialog } from './ShareDialog'
import { StatusBar } from './StatusBar'
import { TabStrip } from './TabStrip'
import { useAppShortcuts } from './use-app-shortcuts'
import { VariableValueDialog } from './VariableValueDialog'
import { setCompareId, uiStore } from './ui-store'
import { Welcome } from './Welcome'
import { MixedWorkspace } from './MixedWorkspace'
import { QuickHighlight } from '#/components/highlights/QuickHighlight'
import {
  DeleteProfileDialog,
  ProfileDialog,
} from '#/components/profiles/ProfileDialogs'
import { useOpenFiles } from '#/hooks/use-files'
import { useMediaQuery } from '#/hooks/use-media-query'
import { onSaveFailed } from '#/lib/store/persist'
import { sessionStore, setActive, setPanelOpen } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

export function EditorApp() {
  const files = useOpenFiles()
  const storedActive = useSelector(sessionStore, (s) => s.activeId)
  const wide = useMediaQuery('(min-width: 768px)')
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Fall back to the first tab when the stored one is gone (closed here
  // or in another browser tab).
  const activeId = files.some((f) => f.id === storedActive)
    ? storedActive
    : (files.at(0)?.id ?? null)
  useEffect(() => {
    if (activeId !== storedActive) setActive(activeId)
  }, [activeId, storedActive])

  useEffect(() => onSaveFailed(reportSaveFailed), [])

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
    fileIds: files.map((f) => f.id),
    onOpenFromDisk: openFromDisk,
    onTogglePanel: () => {
      setPanelOpen(!sessionStore.state.panelOpen)
    },
  })

  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files')

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden"
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
      <AppHeader>
        {files.length > 0 ? (
          <TabStrip files={files} activeId={activeId} />
        ) : (
          <div className="flex-1" />
        )}
      </AppHeader>
      <main id="main" className="min-h-0 flex-1">
        {activeId ? (
          <MixedWorkspace fileId={activeId} compareId={compareId} wide={wide} />
        ) : (
          <Welcome onOpenFromDisk={openFromDisk} />
        )}
      </main>
      <StatusBar />

      <RenameDialog />
      <ArchiveDialog />
      <CommandMenu activeId={activeId} onOpenFromDisk={openFromDisk} />
      <CloseDialog openIds={files.map((f) => f.id)} />
      <DefaultsConfirmDialog />
      <VarsConfirmDialog />
      <RestoreDialog />
      <VariableValueDialog />
      <PasteDialog />
      <ProfileDialog />
      <DeleteProfileDialog />
      <QuickHighlight />
      <ShareLinkDialog activeId={activeId} />
      <OpenSharedDialog />

      <div
        aria-hidden={!dragging}
        className={cn(
          'pointer-events-none absolute inset-2 z-50 hidden place-items-center border-2 border-dashed border-ring bg-background/80',
          dragging && 'grid',
        )}
      >
        <div className="flex flex-col items-center gap-2 text-sm">
          <IconFileUpload className="size-6" />
          {m.drop_files()}
        </div>
      </div>
    </div>
  )
}
