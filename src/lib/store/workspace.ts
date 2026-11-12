import { loadDiskLinks, loadDiskRoots } from './disk'
import { filesCollection } from './files'
import { workspaceReady as collectionsReady } from './persist'
import { sessionStore } from './session'
import { singleton } from './singleton'
// Each collection registers itself when its module loads, so load them all
// before waiting on them.
import './folders'
import './defaults'
import './highlights'
import './pins'
import './profiles'
import './variables'

/**
 * Resolves once the stored files, settings, links to disk and folders opened
 * from disk are loaded. They load once: the editor's route asks again every
 * time its title changes, and reading the links again then could bring back
 * one a save was just replacing.
 */
export function workspaceReady() {
  return singleton('workspaceLoaded', async () => {
    await collectionsReady()
    await Promise.all([
      loadDiskLinks(new Set(filesCollection.keys())),
      loadDiskRoots(),
    ])
  })
}

/** The name of the file in the editor, for the page's title. */
export function activeFileName() {
  const { activeId } = sessionStore.state
  const file = activeId ? filesCollection.get(activeId) : undefined
  return file?.deletedAt === null ? file.name : undefined
}
