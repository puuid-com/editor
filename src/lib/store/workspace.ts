import { loadDiskLinks, loadDiskRoots } from './disk'
import { filesCollection } from './files'
import { workspaceReady as collectionsReady } from './persist'
import { singleton } from './singleton'
import { logEvent } from '#/lib/rescue/client'
// Each collection registers itself when its module loads, so load them all
// before waiting on them.
import './folders'
import './defaults'
import './highlights'
import './pins'
import './profiles'
import './variables'

/**
 * How long the editor waits for the files and folders opened from disk
 * before it opens without them. Another tab, even one the browser put to
 * sleep, can hold their databases for as long as it likes.
 */
export const DISK_WAIT_MS = 3000

/**
 * Resolves once the stored files and settings are loaded, along with the
 * links to disk and folders opened from disk, or once those have taken
 * `DISK_WAIT_MS`: they then arrive while the editor is up. They load once:
 * the editor's route asks again each time it is entered, and reading the
 * links again then could bring back one a save was just replacing.
 */
export function workspaceReady() {
  return singleton('workspaceLoaded', async () => {
    await collectionsReady()
    logEvent('info', 'Reconnecting files and folders opened from disk')
    const waiting = new Set(['files', 'folders'])
    const started = Date.now()
    const reconnected = Promise.all([
      loadDiskLinks(new Set(filesCollection.keys())).finally(() =>
        waiting.delete('files'),
      ),
      loadDiskRoots().finally(() => waiting.delete('folders')),
    ])
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = await Promise.race([
      reconnected.then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), DISK_WAIT_MS)
      }),
    ])
    clearTimeout(timer)
    if (!timedOut) return
    logEvent(
      'warn',
      `Still reconnecting the ${[...waiting].join(' and ')} opened from disk; showing the editor without them`,
    )
    void reconnected.then(() =>
      logEvent(
        'info',
        `Files and folders opened from disk reconnected after ${Math.round((Date.now() - started) / 1000)} s`,
      ),
    )
  })
}
