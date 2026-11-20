import { openDiskFile } from './disk-workspace'
import type { FileMatch } from './file-search'
import { notify } from './notice-store'
import { setSettingsActive } from './settings-tab'
import { endCompare } from './ui-store'
import { focusFileView } from '#/components/editor/editor-store'
import { fileAtPath } from '#/lib/disk-tree'
import { diskRoot } from '#/lib/store/disk'
import { fileAt, filesCollection, isOpen, reopenFile } from '#/lib/store/files'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'

/** The editor receives the selection after the palette releases focus, even when it has to mount first. */
export async function openSearchMatch(hit: FileMatch) {
  let fileId = hit.fileId
  try {
    if (hit.location) {
      const { rootId, path } = hit.location
      const open = fileAt(rootId, path)
      if (open) fileId = open.id
      else {
        const root = diskRoot(rootId)
        if (!root || root.access !== 'granted') {
          notify.info(m.find_match_changed())
          return
        }
        const handle = await fileAtPath(root.handle, path)
        const id = await openDiskFile(root, {
          name: handle.name,
          path,
          kind: 'file',
          handle,
        })
        if (!id) return
        fileId = id
      }
    } else {
      await reopenFile(fileId)
    }
    if (!isOpen(filesCollection.get(fileId))) {
      notify.info(m.find_match_changed())
      return
    }
  } catch {
    notify.info(m.find_match_changed())
    return
  }
  setSettingsActive(false)
  endCompare()
  setActive(fileId)
  // A view hidden behind Settings or a comparison can already be registered.
  // Let the pane reveal it before trying to focus it.
  requestAnimationFrame(() => {
    if (sessionStore.state.activeId !== fileId) return
    focusFileView(fileId, (view) => {
      const to = hit.from + hit.text.length
      if (
        to > view.state.doc.length ||
        view.state.sliceDoc(hit.from, to) !== hit.text
      ) {
        notify.info(m.find_match_changed())
        return
      }
      view.dispatch({
        selection: { anchor: hit.from, head: to },
        scrollIntoView: true,
        userEvent: 'select.search',
      })
    })
  })
}
