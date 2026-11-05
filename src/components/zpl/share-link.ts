import { writeClipboard } from '#/lib/zpl/export'
import { encodeShareHash } from '#/lib/zpl/share'
import { zplStore, selectFile } from './store'

export function useCopyShareLink(panelId: string) {
  return async () => {
    const file = selectFile(zplStore.state, panelId)
    if (!file?.source.trim()) return
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = encodeShareHash(file.source, file.settings)
    await writeClipboard(url.href)
  }
}
