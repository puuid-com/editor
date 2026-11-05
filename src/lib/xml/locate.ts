import { childElements, isElement } from './model'
import type { XmlElement, XmlNode } from './model'

/** Deepest element whose range contains `pos`. */
export function elementAt(
  nodes: Array<XmlNode>,
  pos: number,
): XmlElement | null {
  let found: XmlElement | null = null
  let level = nodes
  for (;;) {
    // A cursor right after `</b>` belongs to `b` unless a sibling starts there.
    const hit =
      level.find(
        (node): node is XmlElement =>
          isElement(node) && node.from <= pos && pos < node.to,
      ) ??
      level.find(
        (node): node is XmlElement => isElement(node) && node.to === pos,
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
  for (;;) {
    const hit = level.find(
      (node): node is XmlElement =>
        isElement(node) &&
        (node.path === path || path.startsWith(node.path + '/')),
    )
    if (!hit) return null
    if (hit.path === path) return hit
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
 * Short labels telling apart elements of the same name by showing only where
 * their paths differ: `ShipmentLine[2]`, `ShipFrom`, or `Line[2]/[...]` when
 * layers shared by all of them sit between that and the element. A JSON
 * array entry goes on its key, as in `lines[0]`; `isItem` says which paths
 * are array entries.
 */
export function occurrenceLabels(
  paths: ReadonlyArray<string>,
  isItem: (path: string) => boolean = () => false,
): Array<string> {
  if (paths.length === 0) return []
  const all = paths.map((path) => pathSteps(path, isItem))
  const keys = all.map((steps) => steps.map(stepKey))
  const shortest = Math.min(...keys.map((parts) => parts.length))
  const same = (at: (parts: Array<string>) => string | undefined) =>
    keys.every((parts) => at(parts) === at(keys[0]))
  let prefix = 0
  while (prefix < shortest && same((parts) => parts[prefix])) prefix++
  let suffix = 0
  while (prefix + suffix < shortest && same((parts) => parts.at(-1 - suffix)))
    suffix++
  // A name seen at a later position keeps its `[1]` too.
  const later = new Set(
    all
      .flat()
      .filter((step) => step.pos > 1)
      .map((step) => step.name),
  )
  const show = (step: Step) =>
    decodeSegment(step.name) +
    (step.pos > 1 || (step.pos === 1 && later.has(step.name))
      ? `[${step.pos}]`
      : '') +
    step.items
  const middles = all.map((steps) => steps.slice(prefix, steps.length - suffix))
  const aligned = middles.every((middle) => middle.length === middles[0].length)

  const labels = all.map((steps, i) => {
    const middle = middles[i]
    const parts: Array<string> = []
    let last: number
    if (middle.length === 0) {
      // Sits higher than the others: name the last step they share.
      last = Math.max(prefix - 1, 0)
      parts.push(show(steps[last]))
    } else {
      last = prefix + middle.length - 1
      middle.forEach((step, at) => {
        const shared =
          aligned &&
          middles.every((other) => stepKey(other[at]) === stepKey(step))
        if (!shared) parts.push(show(step))
        else if (parts.at(-1) !== SKIPPED) parts.push(SKIPPED)
      })
    }
    if (last < steps.length - 2) parts.push(SKIPPED)
    return parts.join('/')
  })
  // Unusual shapes can still collide; fall back to the whole parent path.
  return labels.map((label, i) =>
    labels.indexOf(label) === labels.lastIndexOf(label)
      ? label
      : displayPath(paths[i]).slice(0, -1).join('/'),
  )
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
