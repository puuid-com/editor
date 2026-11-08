import { parentPath } from './disk-tree'
import { isImagePath } from './obsidian'

// Images pasted into a note of a folder opened from disk are saved in the
// folder and linked from the note with a path relative to it.

/** Where pasted images go, from the folder's root, unless a vault sets its own. */
export const IMAGE_FOLDER = 'attachements/img'

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
}

/** The images a paste carries, or none when it is text that happens to come with one. */
export function pastedImages(
  files: ReadonlyArray<File>,
  text: string,
): Array<File> {
  const images = files.filter((file) => file.type in EXTENSIONS)
  // Spreadsheets and word processors put a picture of the copied text on
  // the clipboard too; a copied image file comes with its name.
  const trimmed = text.trim()
  return !trimmed || isImagePath(trimmed) ? images : []
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The file name to save a pasted image as: its own name when it has one,
 * else `image-YYYYMMDD-HHmmss` (a screenshot is just `image.png`).
 */
export function imageFileName(file: Pick<File, 'name' | 'type'>, date: Date) {
  const name = file.name.replace(/[\\/:*?"<>|]/g, '-').trim()
  if (name && !/^image\.\w+$/i.test(name) && isImagePath(name)) return name
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `image-${stamp}.${EXTENSIONS[file.type] ?? 'png'}`
}

/** The path from the folder holding `from` to the file at `to`. */
export function relativePath(from: string, to: string) {
  const base = parentPath(from)
  const left = base ? base.split('/') : []
  const right = to.split('/')
  let shared = 0
  while (
    shared < left.length &&
    shared < right.length - 1 &&
    left[shared] === right[shared]
  )
    shared++
  return [...left.slice(shared).map(() => '..'), ...right.slice(shared)].join(
    '/',
  )
}

/** The Markdown that shows the image at `imagePath` in the note at `notePath`. */
export function imageMarkdown(notePath: string, imagePath: string) {
  const href = encodeURI(relativePath(notePath, imagePath)).replace(
    /[()]/g,
    (char) => (char === '(' ? '%28' : '%29'),
  )
  return `![](${href})`
}
