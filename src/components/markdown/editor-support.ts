import { imagePaste } from './image-paste'
import { markdownSupport } from './md-language'
import { liveEmbeds } from './md-live-embeds'
import type { Extension } from '@codemirror/state'

/**
 * Everything a Markdown file adds to the editor: its language and live
 * preview, pasted images and drawn embeds. Fetched when a note first shows
 * (see `lazySupport`), so files of every other type never pay for it.
 */
export function markdownEditor(): Extension {
  return [markdownSupport(), imagePaste, liveEmbeds]
}
