import { Store } from '@tanstack/store'
import { languageOf } from '#/lib/document'
import { filesCollection, isOpen, saveZplSettings } from '#/lib/store/files'
import { persistedStore } from '#/lib/store/persist'
import { DEFAULT_SETTINGS } from '#/lib/zpl/settings'
import type { LabelSettings } from '#/lib/zpl/settings'
import type { XmlFile } from '#/lib/store/files'

// The shared DB owns files. This read-only projection lets the imported ZPL
// tools select just the source/settings they need without another saved library.
const preferences = persistedStore('zpl-preferences', () => localStorage, {
  explain: true,
  syncZoom: false,
})

/** A file the ZPL tools work on: a label, not deleted. */
function isLabel(file: XmlFile) {
  return (
    file.deletedAt === null && languageOf(file.name, file.content) === 'zpl'
  )
}

// Only labels are kept, so typing in any other file leaves the store, and
// every preview reading it, alone. Ids, as the rows are new on each edit.
const labelIds = new Set(
  [...filesCollection.values()].filter(isLabel).map((file) => file.id),
)
const labels = () =>
  [...filesCollection.values()].filter((file) => labelIds.has(file.id))

export const zplStore = new Store({
  files: labels(),
  ...preferences.state,
})
filesCollection.subscribeChanges((changes) => {
  let changed = false
  for (const change of changes) {
    const id = String(change.key)
    if (change.type !== 'delete' && isLabel(change.value)) {
      labelIds.add(id)
      changed = true
    } else if (labelIds.delete(id)) changed = true
  }
  if (changed) zplStore.setState((s) => ({ ...s, files: labels() }))
})
preferences.subscribe(() =>
  zplStore.setState((s) => ({ ...s, ...preferences.state })),
)

type SelectedFile = {
  source: string
  fileName: string
  settings: LabelSettings
}

// One result per row, so a selector returning it only changes, and wakes
// its component, when that file does.
const selected = new WeakMap<XmlFile, SelectedFile>()

export function selectFile(
  state: { files: Array<XmlFile> },
  id: string,
): SelectedFile | undefined {
  const file = state.files.find((f) => f.id === id && f.deletedAt === null)
  if (!file) return undefined
  let result = selected.get(file)
  if (!result) {
    result = {
      source: file.content,
      fileName: file.name.replace(/\.zpl$/i, ''),
      settings: file.zplSettings ?? DEFAULT_SETTINGS,
    }
    selected.set(file, result)
  }
  return result
}
export function setSettings(id: string, settings: Partial<LabelSettings>) {
  const file = filesCollection.get(id)
  if (file)
    saveZplSettings(id, {
      ...(file.zplSettings ?? DEFAULT_SETTINGS),
      ...settings,
    })
}
export function setExplain(explain: boolean) {
  preferences.setState((s) => ({ ...s, explain }))
}
export function setSyncZoom(syncZoom: boolean) {
  preferences.setState((s) => ({ ...s, syncZoom }))
  if (syncZoom) zoomStore.setState(() => ({}))
}
export type PreviewZoom = number | 'fit'
export const zoomStore = new Store<Record<string, PreviewZoom | undefined>>({})
export function setPreviewZoom(id: string, zoom: PreviewZoom) {
  const ids = zplStore.state.syncZoom
    ? zplStore.state.files.map((f) => f.id)
    : [id]
  zoomStore.setState((s) => ({
    ...s,
    ...Object.fromEntries(ids.map((key) => [key, zoom])),
  }))
}

/** The ZPL file each pane compares its label with, keyed by the pane's file. */
export const compareStore = new Store<Record<string, string | undefined>>({})
export function setCompareTarget(id: string, target: string | null) {
  compareStore.setState((s) => ({ ...s, [id]: target ?? undefined }))
}

/** The other open ZPL files a file can compare with or sync zoom with. */
export function zplCandidates(state: { files: Array<XmlFile> }, id: string) {
  // The store holds labels only, so their type is known already.
  return state.files.filter((f) => f.id !== id && isOpen(f))
}
