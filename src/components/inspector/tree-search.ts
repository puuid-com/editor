import { flattenVisible } from '#/lib/xml/locate'
import { isElement, leafValue } from '#/lib/xml/model'
import type { TreeRow } from '#/lib/xml/locate'
import type { XmlElement, XmlNode } from '#/lib/xml/model'

/** The normalised form of a search query that values are matched against. */
export function searchNeedle(query: string) {
  return query.trim().toLocaleLowerCase()
}

/** `[from, to)` offsets of each non-overlapping `needle` in `text`, ignoring case. */
export function matchRanges(text: string, needle: string) {
  const ranges: Array<[number, number]> = []
  if (!needle) return ranges
  const haystack = text.toLocaleLowerCase()
  // Lowercasing can change the length (e.g. `İ`), so offsets would no longer
  // line up with the original text.
  if (haystack.length !== text.length) return ranges
  for (
    let from = haystack.indexOf(needle);
    from !== -1;
    from = haystack.indexOf(needle, from + needle.length)
  ) {
    ranges.push([from, from + needle.length])
  }
  return ranges
}

/** Whether an element's name, text or one of its attributes holds `needle`. */
function holds(el: XmlElement, needle: string) {
  const has = (value: string) => value.toLocaleLowerCase().includes(needle)
  return (
    has(el.name) ||
    el.attrs.some((attr) => has(attr.name) || has(attr.value)) ||
    has(leafValue(el))
  )
}

/** Match a node's own name, attributes and text, retaining ancestors for context. */
export function searchTree(
  nodes: Array<XmlNode>,
  query: string,
  collapsed: ReadonlySet<string>,
  editingPath: string | null = null,
) {
  const needle = searchNeedle(query)
  const matches = new Set<string>()
  if (!needle) return { rows: flattenVisible(nodes, collapsed), matches }

  // One pass in document order: an element shows when it matches, holds the
  // in-progress edit (kept mounted when its new value stops matching), or
  // has a child that shows. Children of a collapsed row are searched for
  // matches but not listed.
  const rows: Array<TreeRow | null> = []
  const visit = (el: XmlElement, depth: number, listed: boolean) => {
    const matched = holds(el, needle)
    if (matched) matches.add(el.path)
    const isCollapsed = collapsed.has(el.path)
    // Its place comes before its children's; filled once they are known.
    const at = rows.length
    if (listed) rows.push(null)
    let hasChildren = false
    for (const child of el.children) {
      if (!isElement(child)) continue
      if (visit(child, depth + 1, listed && !isCollapsed)) hasChildren = true
    }
    const shown = matched || hasChildren || el.path === editingPath
    if (!listed) return shown
    // A row that doesn't show has no listed descendants: only its place.
    if (!shown) rows.pop()
    else rows[at] = { el, depth, hasChildren, collapsed: isCollapsed }
    return shown
  }
  for (const node of nodes) if (isElement(node)) visit(node, 0, true)
  return { rows: rows as Array<TreeRow>, matches }
}
