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
export const zplStore = new Store({
  files: [...filesCollection.values()],
  ...preferences.state,
})
filesCollection.subscribeChanges(() => {
  zplStore.setState((s) => ({ ...s, files: [...filesCollection.values()] }))
})
preferences.subscribe(() =>
  zplStore.setState((s) => ({ ...s, ...preferences.state })),
)

export function selectFile(state: { files: Array<XmlFile> }, id: string) {
  const file = state.files.find((f) => f.id === id && f.deletedAt === null)
  return file
    ? {
        source: file.content,
        fileName: file.name.replace(/\.zpl$/i, ''),
        settings: file.zplSettings ?? DEFAULT_SETTINGS,
      }
    : undefined
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
  return state.files.filter(
    (f) => f.id !== id && isOpen(f) && languageOf(f.name, f.content) === 'zpl',
  )
}
