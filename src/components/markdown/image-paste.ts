import { EditorView } from '@codemirror/view'

import { diskKeys, vaultQuery } from '#/components/app/disk-queries'
import { errorDetail, notify } from '#/components/app/notice-store'
import { docLanguage } from '#/components/editor/language'
import { fileIdField } from '#/components/editor/extensions'
import { browserQueryClient } from '#/integrations/tanstack-query/root-provider'
import { writeNewFile } from '#/lib/disk-tree'
import { attachmentFolder } from '#/lib/obsidian'
import {
  IMAGE_FOLDER,
  imageFileName,
  imageMarkdown,
  pastedImages,
} from '#/lib/pasted-images'
import { diskRoot, requestRootAccess } from '#/lib/store/disk'
import { filesCollection } from '#/lib/store/files'
import { m } from '#/paraglide/messages'

// Pasting an image into a Markdown note of a folder opened from disk saves
// it in the folder (where the vault's settings say, else `attachements/img`)
// and links it from the note where the cursor is.

async function saveImages(
  view: EditorView,
  fileId: string,
  images: Array<File>,
) {
  const location = filesCollection.get(fileId)?.location
  const root = diskRoot(location?.rootId)
  if (!location || !root) {
    notify.error(m.md_image_needs_folder())
    return
  }
  try {
    if (root.access !== 'granted' && !(await requestRootAccess(root))) {
      notify.error(m.folder_permission_denied({ name: root.name }))
      return
    }
    const client = browserQueryClient()
    const vault = await client.fetchQuery(vaultQuery(root))
    const folder = vault ? attachmentFolder(vault, location.path) : IMAGE_FOLDER
    const now = new Date()
    const links: Array<string> = []
    for (const image of images) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      const path = await writeNewFile(
        root.handle,
        folder,
        imageFileName(image, now),
        image,
      )
      links.push(imageMarkdown(location.path, path))
    }
    void client.invalidateQueries({ queryKey: diskKeys.root(root.id) })
    // The editor may have moved on to another tab while the images saved.
    if (view.state.field(fileIdField) !== fileId) {
      notify.success(m.md_image_saved({ folder: folder || root.name }))
      return
    }
    view.dispatch(view.state.replaceSelection(links.join('\n')), {
      userEvent: 'input.paste',
      scrollIntoView: true,
    })
  } catch (error) {
    notify.error(m.md_image_failed(), {
      detail: errorDetail(error),
    })
  }
}

export const imagePaste = EditorView.domEventHandlers({
  paste(event, view) {
    if (view.state.facet(docLanguage) !== 'md' || !event.clipboardData)
      return false
    const images = pastedImages(
      [...event.clipboardData.files],
      event.clipboardData.getData('text/plain'),
    )
    if (!images.length) return false
    event.preventDefault()
    void saveImages(view, view.state.field(fileIdField), images)
    return true
  },
})
