import { z } from 'zod'

import { isEditableName, parentPath } from './disk-tree'

// Obsidian vaults: folders of Markdown notes with their settings in an
// `.obsidian` folder at the root. The explorer already hides dot folders;
// these read the few settings it follows, and the `[[links]]` notes make to
// each other, as Obsidian resolves them.

/** The folder Obsidian keeps a vault's settings in. */
const CONFIG_FOLDER = '.obsidian'

/** What the editor follows of a vault's settings. */
export interface Vault {
  /**
   * Where new attachments go: a folder from the root ('' for the root
   * itself), or `.` and `./sub` for each note's folder and a folder in it.
   */
  attachments: string
  /** "Excluded files": path prefixes, or `/regex/`, left out of search. */
  excluded: ReadonlyArray<string>
}

const appSettings = z
  .object({
    attachmentFolderPath: z.string().catch(''),
    userIgnoreFilters: z.array(z.string()).catch([]),
  })
  .catch({ attachmentFolderPath: '', userIgnoreFilters: [] })

/** `attachmentFolderPath`: `/` is the root and `./…` from the note's folder. */
function attachmentSetting(path: string) {
  const trimmed = path.trim()
  if (trimmed === '.' || trimmed.startsWith('./')) {
    const sub = trimmed.slice(1).replace(/^\/+|\/+$/g, '')
    return sub ? `./${sub}` : '.'
  }
  return trimmed.replace(/^\/+|\/+$/g, '')
}

const besideNotes = (attachments: string) =>
  attachments === '.' || attachments.startsWith('./')

/** The folder, from the root, a new attachment of the note at `notePath` goes to. */
export function attachmentFolder(vault: Vault, notePath: string) {
  if (!besideNotes(vault.attachments)) return vault.attachments
  return joinRelative(parentPath(notePath), vault.attachments) ?? ''
}

/** A vault's settings from its `app.json`, with defaults for anything unreadable. */
export function parseVaultSettings(json: string | undefined): Vault {
  let value: unknown
  try {
    value = JSON.parse(json ?? '{}')
  } catch {
    value = {}
  }
  const settings = appSettings.parse(value)
  return {
    attachments: attachmentSetting(settings.attachmentFolderPath),
    excluded: settings.userIgnoreFilters.filter((filter) => filter.trim()),
  }
}

/** A folder's vault settings, or null when it isn't an Obsidian vault. */
export async function readVault(
  root: FileSystemDirectoryHandle,
): Promise<Vault | null> {
  let config: FileSystemDirectoryHandle
  try {
    config = await root.getDirectoryHandle(CONFIG_FOLDER)
  } catch {
    return null
  }
  try {
    const file = await (await config.getFileHandle('app.json')).getFile()
    return parseVaultSettings(await file.text())
  } catch {
    // A new vault has no app.json until a setting changes.
    return parseVaultSettings(undefined)
  }
}

/** Whether `path` is the vault's one attachment folder, which holds no notes. */
export function isAttachmentFolder(vault: Vault | null, path: string) {
  return (
    !!vault?.attachments &&
    !besideNotes(vault.attachments) &&
    path.toLowerCase() === vault.attachments.toLowerCase()
  )
}

/** Whether "Excluded files" leaves `path` out of search. */
export function isExcluded(vault: Vault | null, path: string) {
  return !!vault?.excluded.some((filter) => {
    const regex = /^\/(.+)\/$/.exec(filter)
    if (!regex) {
      const prefix = filter.replace(/^\/+/, '')
      return !!prefix && path.startsWith(prefix)
    }
    try {
      return new RegExp(regex[1]).test(path)
    } catch {
      return false
    }
  })
}

/** A new note's file name: Markdown unless it names a type the editor opens. */
export function noteName(name: string) {
  const trimmed = name.trim()
  return isEditableName(trimmed) ? trimmed : `${trimmed}.md`
}

// Links between notes.

/** A `[[target#heading|alias]]` link, or `![[…]]` embed. */
export interface Wikilink {
  target: string
  heading?: string
  alias?: string
}

/** The parts of what's between a wikilink's brackets. */
export function parseWikilink(inner: string): Wikilink {
  // In a table the pipe before an alias is escaped.
  const [link, ...rest] = inner.replace(/\\\|/g, '|').split('|')
  const alias = rest.join('|').trim()
  const hash = link.indexOf('#')
  const target = (hash < 0 ? link : link.slice(0, hash)).trim()
  const heading = hash < 0 ? '' : link.slice(hash + 1).trim()
  return {
    target,
    ...(heading && { heading }),
    ...(alias && { alias }),
  }
}

/** What a wikilink reads as: its alias, else its note and heading. */
export function wikilinkText({ target, heading, alias }: Wikilink) {
  if (alias) return alias
  if (!heading) return target
  return target ? `${target} > ${heading}` : heading
}

/** An image's size in pixels. */
interface ImageSize {
  width: number
  height?: number
}

/**
 * Splits the size off an image's text, as Obsidian reads it: an embed's
 * alias `300`, `300x200` or `caption|300`, or a Markdown image's alt
 * `caption|300` (`markdown`, where a bare number stays the caption).
 */
export function imageSize(
  text = '',
  { markdown = false } = {},
): { label: string; size?: ImageSize } {
  const match = /^(?:([\s\S]*)\|)?\s*(\d+)(?:x(\d+))?\s*$/.exec(text)
  const caption = match?.[1]
  if (!match || (markdown && caption === undefined)) return { label: text }
  return {
    label: caption?.trim() ?? '',
    size: {
      width: Number(match[2]),
      ...(match[3] && { height: Number(match[3]) }),
    },
  }
}

/** `text` with its size set to `width`, as `imageSize` reads it back. */
export function withImageWidth(
  text: string,
  width: number,
  { markdown = false, pipe = '|' } = {},
) {
  const { label } = imageSize(text.replaceAll('\\|', '|'), { markdown })
  if (!label && !markdown) return `${width}`
  return `${label.replaceAll('|', pipe)}${pipe}${width}`
}

export const isMarkdownName = (name: string) => /\.(md|markdown)$/i.test(name)

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * What `![[note#heading]]` shows of a note, as Obsidian does: the heading
 * and everything under it up to the next heading as big, the paragraph
 * marked `^id` for `#^id`, or the whole note without its frontmatter.
 * Null when the heading or block isn't there.
 */
export function noteSection(source: string, heading?: string): string | null {
  const body = source.replace(FRONTMATTER, '')
  // `#Part#Section` names the last heading of a path.
  const wanted = heading?.split('#').at(-1)?.trim()
  if (!wanted) return body
  const lines = body.split(/\r?\n/)
  if (wanted.startsWith('^')) {
    const marker = new RegExp(`\\s\\^${escapeRegExp(wanted.slice(1))}\\s*$`)
    const at = lines.findIndex((line) => marker.test(` ${line}`))
    if (at < 0) return null
    let start = at
    while (start > 0 && lines[start - 1].trim()) start--
    const block = lines.slice(start, at + 1)
    block[block.length - 1] = ` ${lines[at]}`.replace(marker, '').slice(1)
    return block.join('\n')
  }
  let fence: string | null = null
  let start = -1
  let depth = 0
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const open = FENCE.exec(line)
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length)
        fence = null
      continue
    }
    if (open) {
      fence = open[1]
      continue
    }
    const match = ATX.exec(line)
    if (!match) continue
    const level = match[1].length
    if (start >= 0 && level <= depth)
      return lines.slice(start, index).join('\n').trimEnd()
    if (
      start < 0 &&
      (match.at(2) ?? '').trim().toLowerCase() === wanted.toLowerCase()
    ) {
      start = index
      depth = level
    }
  }
  return start < 0 ? null : lines.slice(start).join('\n').trimEnd()
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i

export function isImagePath(path: string) {
  return IMAGE.test(path)
}

/** Whether a Markdown link or image points at a file beside the note, not a site. */
export function isLocalHref(href: string) {
  return (
    !!href &&
    !href.startsWith('#') &&
    !href.startsWith('//') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(href)
  )
}

/** `href` without its URL encoding and `#fragment`, as a path. */
export function hrefPath(href: string) {
  const path = href.split('#')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** `path` from the folder `base`, with `.` and `..` worked out; null above the root. */
function joinRelative(base: string, path: string) {
  const parts = base ? base.split('/') : []
  for (const part of path.split('/')) {
    if (part === '..') {
      if (!parts.length) return null
      parts.pop()
    } else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}

/** How many folders two paths share from the root. */
function sharedFolders(a: string, b: string) {
  const left = a.split('/').slice(0, -1)
  const right = b.split('/').slice(0, -1)
  let count = 0
  while (count < left.length && left[count] === right[count]) count++
  return count
}

/** A file's name in lowercase, and without `.md` for a note. */
function namesOf(path: string) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return new Set([name, name.replace(/\.md$/, '')])
}

/**
 * Finds what links in notes point at among `paths`, as Obsidian does:
 * beside the linking note, then from the root, then anywhere by name,
 * nearest first. Links to notes may leave off `.md`, and case doesn't
 * matter. Paths are indexed once, so a note with many links stays quick.
 */
export function linkResolver(paths: ReadonlyArray<string>) {
  const exact = new Map<string, string>()
  const byName = new Map<string, Array<string>>()
  for (const path of paths) {
    const lower = path.toLowerCase()
    exact.set(lower, path)
    for (const name of namesOf(lower)) {
      const same = byName.get(name)
      if (same) same.push(path)
      else byName.set(name, [path])
    }
  }
  const find = (path: string | null) => {
    if (path === null) return undefined
    const lower = path.toLowerCase()
    return exact.get(lower) ?? exact.get(`${lower}.md`)
  }
  /** The path `target`, linked from the note at `from`, points at. */
  return (target: string, from: string) => {
    const link = target.trim()
    if (!link) return undefined
    const relative = link.startsWith('/')
      ? undefined
      : find(joinRelative(parentPath(from), link))
    const found = relative ?? find(joinRelative('', link))
    if (found) return found
    const path = joinRelative('', link)?.toLowerCase()
    if (!path) return undefined
    const name = path.slice(path.lastIndexOf('/') + 1)
    const ends = (candidate: string) => {
      const lower = `/${candidate.toLowerCase()}`
      return lower.endsWith(`/${path}`) || lower.endsWith(`/${path}.md`)
    }
    return (byName.get(name) ?? [])
      .filter(ends)
      .sort(
        (a, b) =>
          sharedFolders(b, from) - sharedFolders(a, from) ||
          a.length - b.length ||
          a.localeCompare(b),
      )
      .at(0)
  }
}
