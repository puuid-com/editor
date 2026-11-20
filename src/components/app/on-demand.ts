// What the editor shows only when asked: its dialogs, the settings page and
// the contents of a few popovers. One module, so it is fetched in one piece,
// once the editor is idle or when the first of these is asked for.

export { ArchiveDialog } from './ArchiveDialog'
export { DefaultsConfirmDialog, VarsConfirmDialog } from './ChangesDialogs'
export { CommandMenu } from './CommandMenu'
export { DeleteDialog } from './DeleteDialog'
export { NameDialog } from './NameDialog'
export { OpenSharedDialog } from './OpenSharedDialog'
export { PasteOffer } from './PasteOffer'
export { RenameDialog } from './RenameDialog'
export { RestoreDialog } from './RestoreDialog'
export { SettingsPage, SettingsSheet } from './SettingsPage'
export { ShareLinkDialog } from './ShareDialog'
export { ShortcutsDialog } from './ShortcutsDialog'
export { TabListItems } from './TabListItems'
export { VariableValueDialog } from './VariableValueDialog'
export { HighlightsLegend } from '#/components/highlights/HighlightsLegend'
export { QuickHighlight } from '#/components/highlights/QuickHighlight'
export { PdfExportDialog } from '#/components/markdown/pdf/PdfExportDialog'
export {
  DeleteProfileDialog,
  ProfileDialog,
} from '#/components/profiles/ProfileDialogs'
