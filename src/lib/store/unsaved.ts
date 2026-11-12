import { Store } from '@tanstack/store'

import { diskStore } from './disk'
import { filesCollection } from './files'
import { singleton } from './singleton'
import type { XmlFile } from './files'

/** Whether a tab has edits its file on disk doesn't have yet. */
export function isUnsaved(file: Pick<XmlFile, 'id' | 'content'> | undefined) {
  const link = file && diskStore.state[file.id]
  return !!link && link.saved !== file.content
}

/**
 * Ids of the tabs with edits not on disk yet. One subscription keeps it
 * current, so the marks on tabs and explorer rows only render when a file
 * becomes saved or unsaved, not on every key typed into it.
 */
export function unsavedStore() {
  return singleton('unsavedStore', () => {
    const store = new Store<ReadonlySet<string>>(new Set<string>())
    const check = (ids: Iterable<string>) => {
      let next: Set<string> | undefined
      for (const id of ids) {
        const unsaved = isUnsaved(filesCollection.get(id))
        if (unsaved === (next ?? store.state).has(id)) continue
        next ??= new Set(store.state)
        if (unsaved) next.add(id)
        else next.delete(id)
      }
      if (next) store.setState(() => next)
    }

    let links = diskStore.state
    check(Object.keys(links))
    diskStore.subscribe(() => {
      const previous = links
      links = diskStore.state
      // Only the links that changed: a save touches one file.
      check(
        [...Object.keys(previous), ...Object.keys(links)].filter(
          (id) => previous[id] !== links[id],
        ),
      )
    })
    filesCollection.subscribeChanges(
      (changes) => check(changes.map((change) => String(change.key))),
      // Links load after the rows, and are checked then.
      { includeInitialState: false },
    )
    return store
  })
}
