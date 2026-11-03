import { marked } from 'marked'
import type { Token, Tokens } from 'marked'

/** Releases with more bullets than this fold all but the first `FOLD_KEEP`. */
export const FOLD_OVER = 12
export const FOLD_KEEP = 6

export interface ChangelogEntry {
  id: string
  date: string
  /** The notes, or only their first bullets when the rest is folded. */
  html: string
  /** The folded bullets and the total count, for long releases. */
  more?: { html: string; count: number }
}

// Only repository-owned Markdown is passed here. Introductory maintenance
// instructions stay in the source file; the page renders dated entries.
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const headings = [
    ...markdown.matchAll(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm),
  ]
  return headings.map((heading, index) => {
    const tokens = marked.lexer(
      markdown.slice(
        heading.index + heading[0].length,
        headings[index + 1]?.index ?? markdown.length,
      ),
    )
    const entry = { id: heading[1], date: heading[2] }
    const count = tokens.reduce(
      (sum, token) =>
        sum + (token.type === 'list' ? (token as Tokens.List).items.length : 0),
      0,
    )
    if (count <= FOLD_OVER) return { ...entry, html: render(tokens) }
    const [head, rest] = fold(tokens, FOLD_KEEP)
    return {
      ...entry,
      html: render(head),
      more: { html: render(rest), count },
    }
  })
}

const render = (tokens: Token[]) => marked.parser(tokens, { async: false })

/** Splits notes after `keep` bullets, cutting a list in two if needed. */
function fold(tokens: Token[], keep: number): [Token[], Token[]] {
  const head: Token[] = []
  const rest: Token[] = []
  let left = keep
  for (const token of tokens) {
    if (left <= 0) {
      rest.push(token)
      continue
    }
    if (token.type === 'list') {
      const list = token as Tokens.List
      if (list.items.length > left) {
        head.push({ ...list, items: list.items.slice(0, left) })
        rest.push({
          ...list,
          items: list.items.slice(left),
          start: list.ordered ? Number(list.start || 1) + left : list.start,
        })
        left = 0
        continue
      }
      left -= list.items.length
    }
    head.push(token)
  }
  return [head, rest]
}
