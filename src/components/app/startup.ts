import { loadLanguages } from '#/components/editor/language'
import { languageOf } from '#/lib/document'
import { filesCollection, isOpen, openFileIds } from '#/lib/store/files'
import { sessionStore } from '#/lib/store/session'
import { workspaceReady } from '#/lib/store/workspace'

/** The types of the files the editor opens on: the focused one and each pane's. */
function shownLanguages() {
  const { activeId, panes = [] } = sessionStore.state
  const ids = new Set([
    activeId,
    ...panes.map((pane) => pane.activeId),
    // Shown when the focused file is gone, closed in another browser tab.
    openFileIds().at(0),
  ])
  return [...ids].flatMap((id) => {
    const file = id ? filesCollection.get(id) : undefined
    return file && isOpen(file) ? [languageOf(file.name, file.content)] : []
  })
}

/**
 * Resolves once the editor can render as it will look: the stored files and
 * settings are loaded, and so is the support for the file types on screen,
 * which is left out of the first load.
 */
export async function editorReady() {
  await workspaceReady()
  // A type that can't be fetched reads as plain text; the editor still opens.
  await loadLanguages(shownLanguages()).catch(() => undefined)
}
