import { useSelector } from '@tanstack/react-store'
import { useSyncExternalStore } from 'react'

import { Once } from './Once'
import { uiStore } from './ui-store'
import { exportStore } from '#/components/markdown/pdf/export-store'
import { lazyPart } from '#/lib/lazy'
import { isShareHash } from '#/lib/share'
import { hasZplLink } from '#/lib/zpl/tags'
import type { WorkspaceFile } from '#/hooks/use-files'

// The editor opens without its dialogs: none is on screen then, and together
// they are a good part of its code. See on-demand.ts.

const ArchiveDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.ArchiveDialog),
)
const CommandMenu = lazyPart(() =>
  import('./on-demand').then((mod) => mod.CommandMenu),
)
const DefaultsConfirmDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.DefaultsConfirmDialog),
)
const DeleteDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.DeleteDialog),
)
const DeleteProfileDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.DeleteProfileDialog),
)
const OpenSharedDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.OpenSharedDialog),
)
const PdfExportDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.PdfExportDialog),
)
const ProfileDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.ProfileDialog),
)
const QuickHighlight = lazyPart(() =>
  import('./on-demand').then((mod) => mod.QuickHighlight),
)
const RenameDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.RenameDialog),
)
const RestoreDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.RestoreDialog),
)
const ShareLinkDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.ShareLinkDialog),
)
const VariableValueDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.VariableValueDialog),
)
const VarsConfirmDialog = lazyPart(() =>
  import('./on-demand').then((mod) => mod.VarsConfirmDialog),
)

function onHashChange(notify: () => void) {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}

/** Whether the page's address carries something to open: a shared file or a label. */
const hasLink = () => isShareHash(window.location.hash) || hasZplLink()

/** The dialogs of the editor screen, each loaded and mounted when first needed. */
export function Dialogs({
  files,
  activeId,
  activeName,
  onOpenFromDisk,
}: {
  /** The open tabs. */
  files: Array<WorkspaceFile>
  activeId: string | null
  activeName: string | undefined
  onOpenFromDisk: () => void
}) {
  const palette = useSelector(uiStore, (s) => s.paletteOpen)
  const rename = useSelector(uiStore, (s) => s.renameId !== null)
  const archive = useSelector(uiStore, (s) => s.archiveOpen)
  const deleting = useSelector(uiStore, (s) => s.deleteIds !== null)
  const defaults = useSelector(uiStore, (s) => s.defaultsPreview !== null)
  const vars = useSelector(uiStore, (s) => s.varsPreview !== null)
  const restore = useSelector(uiStore, (s) => s.restorePreview !== null)
  const variable = useSelector(uiStore, (s) => s.variableName !== null)
  const profile = useSelector(uiStore, (s) => s.profileDialog !== null)
  const deleteProfile = useSelector(uiStore, (s) => s.deleteProfileId !== null)
  const highlight = useSelector(uiStore, (s) => s.quickHighlight !== null)
  const share = useSelector(uiStore, (s) => s.shareOpen)
  const pdf = useSelector(exportStore, (s) => s !== null)
  // The dialog itself reads the link, and watches for the next one.
  const link = useSyncExternalStore(onHashChange, hasLink, () => false)

  return (
    <>
      <Once shown={pdf}>
        <PdfExportDialog />
      </Once>
      <Once shown={rename}>
        <RenameDialog />
      </Once>
      <Once shown={archive}>
        <ArchiveDialog />
      </Once>
      <Once shown={palette}>
        <CommandMenu
          files={files}
          activeId={activeId}
          onOpenFromDisk={onOpenFromDisk}
        />
      </Once>
      <Once shown={deleting}>
        <DeleteDialog openIds={files.map((f) => f.id)} />
      </Once>
      <Once shown={defaults}>
        <DefaultsConfirmDialog />
      </Once>
      <Once shown={vars}>
        <VarsConfirmDialog />
      </Once>
      <Once shown={restore}>
        <RestoreDialog />
      </Once>
      <Once shown={variable}>
        <VariableValueDialog />
      </Once>
      <Once shown={profile}>
        <ProfileDialog />
      </Once>
      <Once shown={deleteProfile}>
        <DeleteProfileDialog />
      </Once>
      <Once shown={highlight}>
        <QuickHighlight />
      </Once>
      <Once shown={share}>
        <ShareLinkDialog name={activeName} />
      </Once>
      <Once shown={link}>
        <OpenSharedDialog />
      </Once>
    </>
  )
}
