import { allElements } from './locate'
import type { TextChange } from './edit'
import type { XmlNode } from './model'

/** Tag prefixes in use, as `soap` for `<soap:Body>`, with how many tags have each. */
export function tagPrefixes(nodes: Array<XmlNode>) {
  const counts = new Map<string, number>()
  for (const el of allElements(nodes)) {
    const prefix = prefixOf(el.name)
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
  }
  return [...counts].map(([prefix, count]) => ({ prefix, count }))
}

/**
 * Renames `<prefix:Body>` to `<Body>`, open and close tags alike. Other
 * prefixes, attributes and `xmlns:` declarations stay as written.
 */
export function removePrefix(
  nodes: Array<XmlNode>,
  prefix: string,
): { changes: Array<TextChange>; count: number } {
  const changes: Array<TextChange> = []
  let count = 0
  for (const el of allElements(nodes)) {
    if (prefixOf(el.name) !== prefix) continue
    count++
    const cut = prefix.length + 1
    changes.push({ from: el.nameFrom, to: el.nameFrom + cut, insert: '' })
    if (el.closeNameFrom !== null) {
      const from = el.closeNameFrom
      changes.push({ from, to: from + cut, insert: '' })
    }
  }
  return { changes, count }
}

function prefixOf(name: string) {
  const colon = name.indexOf(':')
  return colon > 0 ? name.slice(0, colon) : ''
}
