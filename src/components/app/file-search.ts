import { isImageData } from '#/lib/image-file'
import type { FileLocation } from '#/lib/store/files'

export interface SearchFile {
  id: string
  name: string
  content: string
  location?: FileLocation
}

export interface DiskSearchFile {
  id: string
  name: string
  location: FileLocation
  handle: FileSystemFileHandle
}

export interface SearchSources {
  files: Array<SearchFile>
  disk: Array<DiskSearchFile>
}

export interface FileMatch {
  fileId: string
  location?: FileLocation
  from: number
  line: number
  before: string
  text: string
  after: string
}

export const FILE_LIMIT = 20
export const TOTAL_LIMIT = 100

export interface SearchResults {
  groups: Array<{ id: string; name: string; hits: Array<FileMatch> }>
  limited: boolean
}

/** Case folding stays in the regexp engine so offsets refer to the original text. */
export function findInFiles(
  files: ReadonlyArray<SearchFile>,
  query: string,
  matchCase: boolean,
  limit = TOTAL_LIMIT,
): SearchResults {
  const results: SearchResults = { groups: [], limited: false }
  if (!query) return results
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(literal, matchCase ? 'gu' : 'giu')
  let count = 0
  for (const file of files) {
    const content = file.content
    const breaks = /\r\n?|\n/g
    const hits: Array<FileMatch> = []
    let line = 1
    let lineStart = 0
    let crlfCount = 0
    let nextBreak = breaks.exec(content)
    pattern.lastIndex = 0
    for (let match; (match = pattern.exec(content));) {
      if (count === limit) {
        results.limited = true
        return results
      }
      if (hits.length === FILE_LIMIT) {
        results.limited = true
        break
      }
      const from = match.index
      while (nextBreak && nextBreak.index < from) {
        line++
        lineStart = breaks.lastIndex
        // CodeMirror counts a CRLF on disk as one character.
        crlfCount += nextBreak[0].length - 1
        nextBreak = breaks.exec(content)
      }
      const text = match[0]
      const to = from + text.length
      const before = content.slice(Math.max(lineStart, from - 28), from)
      const after = content.slice(
        to,
        Math.min(to + 64, nextBreak?.index ?? content.length),
      )
      if (!hits.length)
        results.groups.push({ id: file.id, name: file.name, hits })
      hits.push({
        fileId: file.id,
        location: file.location,
        from: from - crlfCount,
        line,
        before,
        text,
        after,
      })
      count++
    }
  }
  return results
}

export interface SearchReply {
  query: string
  matchCase: boolean
  results: SearchResults
  pending: boolean
  skipped: boolean
}

/** Search live browser text first, then read a bounded batch of disk files at a time. */
export async function searchWorkspace(
  { files, disk }: SearchSources,
  terms: Pick<SearchReply, 'query' | 'matchCase'>,
  send: (reply: SearchReply) => void,
  cancelled: () => boolean,
) {
  const { query, matchCase } = terms
  if (!query) return
  const results = findInFiles(files, query, matchCase)
  let remaining =
    TOTAL_LIMIT - results.groups.reduce((sum, g) => sum + g.hits.length, 0)
  let skipped = false
  const publish = (pending: boolean) =>
    send({
      ...terms,
      results,
      pending,
      skipped,
    })
  // Browser edits are available immediately. Read disk files in small batches
  // and drop obsolete searches at the next I/O boundary.
  let lastUpdate = performance.now()
  if (disk.length && remaining > 0) publish(true)
  for (let i = 0; i < disk.length; i += 4) {
    if (remaining === 0) {
      results.limited = true
      break
    }
    const batch = await Promise.allSettled(
      disk.slice(i, i + 4).map(async ({ handle, ...file }) => ({
        ...file,
        content: await (await handle.getFile()).text(),
      })),
    )
    if (cancelled()) return
    const readable: Array<SearchFile> = []
    for (const result of batch) {
      if (result.status === 'rejected') skipped = true
      else if (!isImageData(result.value.content)) readable.push(result.value)
    }
    const next = findInFiles(readable, query, matchCase, remaining)
    results.groups.push(...next.groups)
    results.limited ||= next.limited
    for (const group of next.groups) remaining -= group.hits.length
    if (next.groups.length && performance.now() - lastUpdate >= 100) {
      publish(true)
      lastUpdate = performance.now()
    }
  }
  publish(false)
}
