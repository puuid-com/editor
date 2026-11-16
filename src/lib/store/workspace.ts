import { loadDiskLinks, loadDiskRoots } from './disk'
import { filesCollection } from './files'
import { workspaceReady as collectionsReady } from './persist'
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
 * from disk are loaded. They load once: the editor's route asks again each
 * time it is entered, and reading the links again then could bring back one
 * a save was just replacing.
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
