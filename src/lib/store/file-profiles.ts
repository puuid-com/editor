import { Store } from '@tanstack/store'

import { filesCollection } from './files'
import { singleton } from './singleton'

/**
 * The profile of each file, by file id. It follows the files without their
 * text, so what reads a file's profile isn't woken by every key typed.
 */
export function fileProfileIds() {
  return singleton('fileProfileIds', () => {
    const store = new Store<ReadonlyMap<string, string>>(
      new Map(
        [...filesCollection.values()].map((file) => [file.id, file.profileId]),
      ),
    )
    filesCollection.subscribeChanges(
      (changes) => {
        let next: Map<string, string> | undefined
        for (const change of changes) {
          const id = String(change.key)
          const profileId =
            change.type === 'delete' ? undefined : change.value.profileId
          if ((next ?? store.state).get(id) === profileId) continue
          next ??= new Map(store.state)
          if (profileId === undefined) next.delete(id)
          else next.set(id, profileId)
        }
        if (next) store.setState(() => next)
      },
      // The rows there now are read above.
      { includeInitialState: false },
    )
    return store
  })
}

/**
 * Ids of the files whose variables are off, so what shows variables can
 * tell without reading the files' text.
 */
export function filesWithoutVars() {
  return singleton('filesWithoutVars', () => {
    const store = new Store<ReadonlySet<string>>(
      new Set(
        [...filesCollection.values()]
          .filter((file) => file.vars === false)
          .map((file) => file.id),
      ),
    )
    filesCollection.subscribeChanges(
      (changes) => {
        let next: Set<string> | undefined
        for (const change of changes) {
          const id = String(change.key)
          const off = change.type !== 'delete' && change.value.vars === false
          if ((next ?? store.state).has(id) === off) continue
          next ??= new Set(store.state)
          if (off) next.add(id)
          else next.delete(id)
        }
        if (next) store.setState(() => next)
      },
      { includeInitialState: false },
    )
    return store
  })
}
