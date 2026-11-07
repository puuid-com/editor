import { loadDiskLinks, loadDiskRoots } from './disk'
import { filesCollection } from './files'
import { workspaceReady as collectionsReady } from './persist'
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
 * from disk are loaded.
 */
export async function workspaceReady() {
  await collectionsReady()
  await Promise.all([
    loadDiskLinks(new Set(filesCollection.keys())),
    loadDiskRoots(),
  ])
}
