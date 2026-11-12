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
