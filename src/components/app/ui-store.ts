import { Store } from '@tanstack/store'

import { closeTabs } from './files'
import { openFileIds } from '#/lib/store/files'
import { notify } from './notice-store'
import { m } from '#/paraglide/messages'

import type { DocLanguage } from '#/lib/document'
import type { Backup } from '#/lib/store/backup'
import type { DefaultSummary } from '#/lib/xml/defaults'
import type { ResolvedVar } from '#/lib/xml/dynamic-vars'

// Transient dialog state for the editor screen.
interface UiState {
  paletteOpen: boolean
  renameId: string | null
  /** Browser files waiting for confirmation before they're deleted. */
  deleteIds: Array<string> | null
  /** The searchable list of every open tab. */
  tabListOpen: boolean
  archiveOpen: boolean
  /** Choosing what a share link of the active file carries. */
  shareOpen: boolean
  /** Tag whose colour picker is open next to the editor cursor. */
  quickHighlight: QuickHighlight | null
  /** Defaults waiting for confirmation before they're written to the file. */
  defaultsPreview: Array<DefaultSummary> | null
  /** Variables waiting for confirmation before a filled-in copy is opened. */
  varsPreview: VarsPreview | null
  profileDialog: ProfileDialog | null
  /** Offering a new type and profile for content pasted over a whole file. */
  pasteChoice: PasteChoice | null
  deleteProfileId: string | null
  /** A backup waiting for confirmation before it replaces the workspace. */
  restorePreview: RestorePreview | null
  /** Variable whose value is being set from the editor. */
  variableName: string | null
  /** Tab the active file is being compared with, shown in place of the editor. */
  compareId: string | null
  /** Format both sides before comparing, so only the data differs. */
  compareIgnoreFormatting: boolean
}

/** The filled-in copy of `fileId`, computed up front so the dialog shows its values. */
export interface VarsPreview {
  fileId: string
  /** Text the preview was made from; later edits must not be overwritten. */
  original: string
  text: string
  count: number
  unresolved: number
  vars: Array<ResolvedVar>
  /** Whether the original parsed cleanly, so new errors come from the values. */
  wasValid: boolean
}

/** A backup read from disk, with its date formatted for the reader's locale. */
interface RestorePreview {
  backup: Backup
  date: string
}

/** The pasted file and what the dialog has picked for it so far. */
export interface PasteChoice {
  fileId: string
  /** The type the file reads as now, kept if the offer is turned down. */
  current: DocLanguage
  /** The type the pasted content reads as, or null when nothing gives it away. */
  detected: DocLanguage | null
  language: DocLanguage
  profileId: string
  /** The profile files like this one belong to, if any. */
  bestMatch: string | null
}

/** Creating a profile, or cloning or editing the one with `profileId`. */
export type ProfileDialog =
  { mode: 'create' } | { mode: 'clone' | 'edit'; profileId: string }

interface QuickHighlight {
  tag: string
  /** Viewport coordinates to anchor the picker at. */
  x: number
  y: number
}

export const uiStore = new Store<UiState>({
  paletteOpen: false,
  renameId: null,
  deleteIds: null,
  tabListOpen: false,
  archiveOpen: false,
  shareOpen: false,
  quickHighlight: null,
  defaultsPreview: null,
  varsPreview: null,
  profileDialog: null,
  pasteChoice: null,
  deleteProfileId: null,
  restorePreview: null,
  variableName: null,
  compareId: null,
  compareIgnoreFormatting: false,
})

/** A function that sets one field of the store. */
function setter<TKey extends keyof UiState>(key: TKey) {
  return (value: UiState[TKey]) =>
    uiStore.setState((s) => ({ ...s, [key]: value }))
}

export const setPaletteOpen = setter('paletteOpen')
export const askRename = setter('renameId')
export const setTabListOpen = setter('tabListOpen')
export const setArchiveOpen = setter('archiveOpen')
export const setShareOpen = setter('shareOpen')
export const setQuickHighlight = setter('quickHighlight')
export const setDefaultsPreview = setter('defaultsPreview')
export const setVarsPreview = setter('varsPreview')
export const setProfileDialog = setter('profileDialog')
export const setPasteChoice = setter('pasteChoice')
export const askDeleteProfile = setter('deleteProfileId')
export const setRestorePreview = setter('restorePreview')
export const askVariableValue = setter('variableName')
/** Compares the active file with `compareId`, or closes the comparison. */
export const setCompareId = setter('compareId')
export const setCompareIgnoreFormatting = setter('compareIgnoreFormatting')

/** Closes one tab, or several. Nothing is lost, so nothing is asked. */
export function closeTab(ids: string | Array<string>) {
  const closeIds = typeof ids === 'string' ? [ids] : ids
  if (!closeIds.length) return
  void closeTabs(closeIds, openFileIds()).catch(() =>
    notify.error(m.close_failed()),
  )
}

/** Asks before moving browser files to the archive. */
export function askDelete(ids: string | Array<string> | null) {
  const deleteIds = typeof ids === 'string' ? [ids] : ids?.length ? ids : null
  uiStore.setState((s) => ({ ...s, deleteIds }))
}

/** Changes what the paste bar has picked. */
export function updatePasteChoice(
  changes: Partial<Pick<PasteChoice, 'language' | 'profileId'>>,
) {
  uiStore.setState((s) =>
    s.pasteChoice ? { ...s, pasteChoice: { ...s.pasteChoice, ...changes } } : s,
  )
}
