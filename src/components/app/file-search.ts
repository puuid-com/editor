export interface SearchFile {
  id: string
  name: string
  content: string
}

export interface FileMatch {
  fileId: string
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
      if (count === TOTAL_LIMIT) {
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
