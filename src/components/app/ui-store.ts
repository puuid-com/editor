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
  palette: 'commands' | 'find' | null
  renameId: string | null
  /** Browser files waiting for confirmation before they're deleted. */
  deleteIds: Array<string> | null
  /** The searchable list of every open tab. */
  tabListOpen: boolean
  archiveOpen: boolean
  /** The list of every keyboard shortcut. */
  shortcutsOpen: boolean
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
  /** A file compared with another tab, shown in place of its editor. */
  compare: CompareTarget | null
  /** The other tab reads as the new side instead of the original. */
  compareSwapped: boolean
  /** Format both sides before comparing, so only the data differs. */
  compareIgnoreFormatting: boolean
  /** Lines that differ only in spaces and tabs count as unchanged. */
  compareIgnoreWhitespace: boolean
}

/** `fileId`, while it's the active file, compared with tab `otherId`. */
interface CompareTarget {
  fileId: string
  otherId: string
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
  palette: null,
  renameId: null,
  deleteIds: null,
  tabListOpen: false,
  archiveOpen: false,
  shortcutsOpen: false,
  shareOpen: false,
  quickHighlight: null,
  defaultsPreview: null,
  varsPreview: null,
  profileDialog: null,
  pasteChoice: null,
  deleteProfileId: null,
  restorePreview: null,
  variableName: null,
  compare: null,
  compareSwapped: false,
  compareIgnoreFormatting: false,
  compareIgnoreWhitespace: false,
})

/** A function that sets one field of the store. */
function setter<TKey extends keyof UiState>(key: TKey) {
  return (value: UiState[TKey]) =>
    uiStore.setState((s) => ({ ...s, [key]: value }))
}

export const setPalette = setter('palette')
export const askRename = setter('renameId')
export const setTabListOpen = setter('tabListOpen')
export const setArchiveOpen = setter('archiveOpen')
export const setShortcutsOpen = setter('shortcutsOpen')
export const setShareOpen = setter('shareOpen')
export const setQuickHighlight = setter('quickHighlight')
export const setDefaultsPreview = setter('defaultsPreview')
export const setVarsPreview = setter('varsPreview')
export const setProfileDialog = setter('profileDialog')
export const setPasteChoice = setter('pasteChoice')
export const askDeleteProfile = setter('deleteProfileId')
export const setRestorePreview = setter('restorePreview')
export const askVariableValue = setter('variableName')
export const setCompareIgnoreFormatting = setter('compareIgnoreFormatting')
export const setCompareIgnoreWhitespace = setter('compareIgnoreWhitespace')

/** Compares `fileId` with tab `otherId`, the other tab as the original. */
export function openCompare(fileId: string, otherId: string) {
  uiStore.setState((s) => ({
    ...s,
    compare: { fileId, otherId },
    compareSwapped: false,
  }))
}

/** Ends the comparison, if one is open. */
export function endCompare() {
  uiStore.setState((s) => (s.compare ? { ...s, compare: null } : s))
}

/** Trades which side reads as the original. */
export function swapCompare() {
  uiStore.setState((s) => ({ ...s, compareSwapped: !s.compareSwapped }))
}

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
