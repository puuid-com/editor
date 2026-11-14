import { childElements, isElement } from './model'
import type { XmlElement, XmlNode } from './model'

/** Index of the last of `nodes`, in document order, starting at or before `pos`. */
function lastStartingBy(nodes: Array<XmlNode>, pos: number) {
  let lo = 0
  let hi = nodes.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (nodes[mid].from <= pos) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/**
 * Deepest element whose range contains `pos`. Siblings are in document order
 * and don't overlap, so each level is a binary search: the cursor moves on
 * every key, and a level can hold thousands of records.
 */
export function elementAt(
  nodes: Array<XmlNode>,
  pos: number,
): XmlElement | null {
  let found: XmlElement | null = null
  let level = nodes
  for (;;) {
    const index = lastStartingBy(level, pos)
    const node = index >= 0 ? level[index] : undefined
    const previous = index > 0 ? level[index - 1] : undefined
    // A cursor right after `</b>` belongs to `b` unless a sibling starts there.
    const hit =
      node && isElement(node) && pos < node.to
        ? node
        : [node, previous].find(
            (near): near is XmlElement =>
              !!near && isElement(near) && near.to === pos,
          )
    if (!hit) return found
    found = hit
    level = hit.children
  }
}

/** Finds an element by its path. */
export function elementByPath(
  nodes: Array<XmlNode>,
  path: string,
): XmlElement | null {
  let level = nodes
  // Segments never hold a `/` (JSON keys escape it), so each level looks
  // for the path up to its next one.
  let end = 0
  for (;;) {
    const next = path.indexOf('/', end + 1)
    end = next < 0 ? path.length : next
    const step = path.slice(0, end)
    const hit = level.find(
      (node): node is XmlElement => isElement(node) && node.path === step,
    )
    if (!hit || end === path.length) return hit ?? null
    level = hit.children
  }
}

/** All ancestor paths of `path`, outermost first. */
export function ancestorPaths(path: string): Array<string> {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, i) => '/' + parts.slice(0, i + 1).join('/'))
}

export interface TreeRow {
  el: XmlElement
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

/** Flattens the element tree into visible rows, skipping collapsed subtrees. */
export function flattenVisible(
  nodes: Array<XmlNode>,
  collapsed: ReadonlySet<string>,
): Array<TreeRow> {
  const rows: Array<TreeRow> = []
  const visit = (el: XmlElement, depth: number) => {
    const kids = childElements(el)
    const isCollapsed = collapsed.has(el.path)
    rows.push({
      el,
      depth,
      hasChildren: kids.length > 0,
      collapsed: isCollapsed,
    })
    if (!isCollapsed) for (const kid of kids) visit(kid, depth + 1)
  }
  for (const node of nodes) if (isElement(node)) visit(node, 0)
  return rows
}

/** Every element in document order. */
export function allElements(nodes: Array<XmlNode>): Array<XmlElement> {
  const out: Array<XmlElement> = []
  const visit = (node: XmlNode) => {
    if (!isElement(node)) return
    out.push(node)
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

/** Path shown to people: `root › item[2] › name`, dropping `[1]`. */
export function displayPath(path: string): Array<string> {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => decodeSegment(part.replace(/\[1\]$/, '')))
}

/** Stands for layers a label skips over. */
const SKIPPED = '[...]'

/** A path step; `items` holds the JSON array indexes on it, like `[0]`. */
type Step = { name: string; pos: number; items: string }

/**
 * Short labels telling apart elements of the same name. Each names only the
 * steps where its path branches off from the others, such as
 * `ShipmentLine[2]` or `ShipFrom`, then drops unindexed ones (containers like
 * `ShipmentLines`) the label doesn't need, so a repeated element's index
 * wins. `[...]` stands for layers skipped between steps or before the
 * element. A JSON array entry goes on its key, as in `lines[0]`; `isItem`
 * says which paths are array entries.
 */
export function occurrenceLabels(
  paths: ReadonlyArray<string>,
  isItem: (path: string) => boolean = () => false,
): Array<string> {
  if (paths.length === 0) return []
  const all = paths.map((path) => pathSteps(path, isItem))
  const keys = all.map((steps) => steps.map(stepKey))
  // A name seen at a later position is repeated, so its `[1]` counts too.
  const later = new Set(
    all
      .flat()
      .filter((step) => step.pos > 1)
      .map((step) => step.name),
  )
  const indexed = (step: Step) =>
    step.items !== '' ||
    step.pos > 1 ||
    (step.pos === 1 && later.has(step.name))
  const show = (step: Step) =>
    decodeSegment(step.name) +
    (step.pos > 0 && indexed(step) && step.items === ''
      ? `[${step.pos}]`
      : '') +
    step.items
  // Whether no other path holds these steps of path `i`, in order.
  const unique = (i: number, shown: Array<number>) =>
    keys.every(
      (other, j) =>
        j === i ||
        !holdsInOrder(
          other,
          shown.map((at) => keys[i][at]),
        ),
    )

  const labels = all.map((steps, i) => {
    const own = keys[i]
    const leaf = own.length - 1
    // Where this path branches off from the others that share its start.
    let shown: Array<number> = []
    let group = keys
    own.forEach((key, at) => {
      if (new Set(group.map((other) => other[at])).size > 1) shown.push(at)
      group = group.filter((other) => other[at] === key)
    })
    // The element's own name says nothing unless it has a position.
    if (shown.at(-1) === leaf && !indexed(steps[leaf]) && leaf > 0) {
      shown = [...new Set([...shown.slice(0, -1), leaf - 1])]
    }
    for (const at of [...shown]) {
      if (indexed(steps[at])) continue
      const rest = shown.filter((other) => other !== at)
      if (rest.length > 0 && unique(i, rest)) shown = rest
    }
    const parts: Array<string> = []
    shown.forEach((at, n) => {
      if (n > 0 && at > shown[n - 1] + 1) parts.push(SKIPPED)
      parts.push(show(steps[at]))
    })
    if ((shown.at(-1) ?? leaf) < leaf - 1) parts.push(SKIPPED)
    return parts.join('/')
  })
  // Unusual shapes can still collide; fall back to the whole parent path.
  return labels.map((label, i) =>
    labels.indexOf(label) === labels.lastIndexOf(label)
      ? label
      : displayPath(paths[i]).slice(0, -1).join('/'),
  )
}

function holdsInOrder(path: Array<string>, wanted: Array<string>) {
  let from = 0
  for (const key of wanted) {
    const found = path.indexOf(key, from)
    if (found < 0) return false
    from = found + 1
  }
  return true
}

function pathSteps(
  path: string,
  isItem: (path: string) => boolean,
): Array<Step> {
  const steps: Array<Step> = []
  let at = ''
  for (const segment of path.split('/').filter(Boolean)) {
    at += `/${segment}`
    const name = segment.replace(/\[\d+\]$/, '')
    const prev = steps.at(-1)
    if (isItem(at)) {
      if (prev) prev.items += `[${name}]`
      else steps.push({ name: '', pos: 0, items: `[${name}]` })
    } else {
      const pos = Number(/\[(\d+)\]$/.exec(segment)?.[1] ?? 1)
      steps.push({ name, pos, items: '' })
    }
  }
  return steps
}

function stepKey(step: Step) {
  return `${step.name}[${step.pos}]${step.items}`
}

/** JSON keys can hold `/`, so path segments escape it (and `%`). */
export function encodeSegment(name: string) {
  return name.replaceAll('%', '%25').replaceAll('/', '%2F')
}

function decodeSegment(segment: string) {
  return segment.replaceAll('%2F', '/').replaceAll('%25', '%')
}
