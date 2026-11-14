/** A stable editor group, with its own ordered tabs and selected file. */
export interface FilePaneGroup {
  id: string
  fileIds: Array<string>
  activeId: string
}

export const MAX_PANES = 4

/** Discard closed tabs and place newly opened files in the active pane. */
export function normalizePanes(
  stored: ReadonlyArray<FilePaneGroup> | undefined,
  openIds: ReadonlyArray<string>,
  activeId: string | null,
): Array<FilePaneGroup> {
  const open = new Set(openIds)
  const seen = new Set<string>()
  const panes = (stored ?? []).slice(0, MAX_PANES).flatMap((pane) => {
    const fileIds = pane.fileIds.filter((id) => {
      if (!open.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
    if (!fileIds.length) return []
    const selected =
      activeId && fileIds.includes(activeId) ? activeId : pane.activeId
    return [
      {
        ...pane,
        fileIds,
        activeId: fileIds.includes(selected) ? selected : fileIds[0],
      },
    ]
  })
  const remaining = openIds.filter((id) => !seen.has(id))
  if (!panes.length) {
    if (!remaining.length) return []
    const selected =
      activeId && remaining.includes(activeId) ? activeId : remaining[0]
    return [{ id: selected, fileIds: remaining, activeId: selected }]
  }
  const target =
    panes.find((p) => p.fileIds.includes(activeId ?? '')) ?? panes[0]
  target.fileIds.push(...remaining)
  if (activeId && target.fileIds.includes(activeId)) target.activeId = activeId
  return panes
}

/** Move or reorder a tab; an emptied source pane disappears. */
export function movePaneTab(
  panes: ReadonlyArray<FilePaneGroup>,
  fileId: string,
  targetId: string,
  beforeId?: string,
): Array<FilePaneGroup> {
  if (
    !panes.some((p) => p.id === targetId) ||
    !panes.some((p) => p.fileIds.includes(fileId))
  )
    return [...panes]
  if (fileId === beforeId) return [...panes]
  return panes
    .map((pane) => {
      const fileIds = pane.fileIds.filter((id) => id !== fileId)
      if (pane.id === targetId) {
        const index = beforeId ? fileIds.indexOf(beforeId) : -1
        fileIds.splice(index < 0 ? fileIds.length : index, 0, fileId)
        return { ...pane, fileIds, activeId: fileId }
      }
      return {
        ...pane,
        fileIds,
        activeId: fileIds.includes(pane.activeId) ? pane.activeId : fileIds[0],
      }
    })
    .filter((p) => p.fileIds.length > 0)
}

/** An edge of a pane, where another one can dock. */
export type PaneEdge = 'left' | 'right' | 'top' | 'bottom'

/** A pane's place in the arrangement, by its id. */
interface PaneLeaf {
  pane: string
}

/** A row or a column of panes and further rows and columns. */
interface PaneSplit {
  id: string
  direction: 'row' | 'column'
  children: Array<PaneLayout>
  /** Each child's share in percent, by `layoutKey`. Even when absent. */
  sizes?: Record<string, number>
}

/** How the panes are arranged on screen. */
export type PaneLayout = PaneLeaf | PaneSplit

const isLeaf = (node: PaneLayout): node is PaneLeaf => 'pane' in node

/** What a node is called in its parent's sizes, and as a resizable panel. */
export const layoutKey = (node: PaneLayout) =>
  isLeaf(node) ? node.pane : node.id

const directionOf = (edge: PaneEdge) =>
  edge === 'left' || edge === 'right' ? 'row' : 'column'

/** The pane ids in reading order: left to right, top to bottom. */
export function layoutPanes(layout: PaneLayout | undefined): Array<string> {
  if (!layout) return []
  return isLeaf(layout) ? [layout.pane] : layout.children.flatMap(layoutPanes)
}

/** Each child's share of its split, which is even unless every one is set. */
function shares(split: PaneSplit): Array<number> {
  const stored = split.children.map((c) => split.sizes?.[layoutKey(c)])
  const even = 100 / split.children.length
  return stored.every((size) => typeof size === 'number' && size > 0)
    ? (stored as Array<number>)
    : split.children.map(() => even)
}

/** A split of `children`, sized by `sizes` scaled to fill it. */
function splitOf(
  split: Pick<PaneSplit, 'id' | 'direction'>,
  children: Array<PaneLayout>,
  sizes: Array<number>,
): PaneSplit {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return {
    id: split.id,
    direction: split.direction,
    children,
    sizes: Object.fromEntries(
      children.map((c, i) => [layoutKey(c), (sizes[i] / total) * 100]),
    ),
  }
}

/**
 * The same arrangement without what `keep` rejects: empty splits go, a split
 * of one becomes its child, and a row inside a row joins it.
 */
function tidy(
  node: PaneLayout,
  keep: (pane: string) => boolean,
): PaneLayout | null {
  if (isLeaf(node)) return keep(node.pane) ? node : null
  const children: Array<PaneLayout> = []
  const sizes: Array<number> = []
  shares(node).forEach((share, i) => {
    const child = tidy(node.children[i], keep)
    if (!child) return
    if (isLeaf(child) || child.direction !== node.direction) {
      children.push(child)
      sizes.push(share)
      return
    }
    shares(child).forEach((inner, j) => {
      children.push(child.children[j])
      sizes.push((share * inner) / 100)
    })
  })
  if (children.length < 2) return children.at(0) ?? null
  return splitOf(node, children, sizes)
}

/** Puts `pane` at the end of the outermost row. */
function append(
  layout: PaneLayout | null,
  pane: string,
  newId: () => string,
): PaneLayout {
  const leaf = { pane }
  if (!layout) return leaf
  if (isLeaf(layout) || layout.direction !== 'row')
    return { id: newId(), direction: 'row', children: [layout, leaf] }
  const sizes = shares(layout)
  return splitOf(
    layout,
    [...layout.children, leaf],
    [...sizes, 100 / layout.children.length],
  )
}

/** Drops panes that are gone and gives the ones without a place one. */
export function normalizeLayout(
  layout: PaneLayout | undefined,
  paneIds: ReadonlyArray<string>,
  newId: () => string = () => crypto.randomUUID(),
): PaneLayout | undefined {
  const wanted = new Set(paneIds)
  const placed = new Set<string>()
  let result = layout
    ? tidy(layout, (pane) => {
        if (!wanted.has(pane) || placed.has(pane)) return false
        placed.add(pane)
        return true
      })
    : null
  for (const pane of paneIds)
    if (!placed.has(pane)) result = append(result, pane, newId)
  return result ?? undefined
}

/** Takes a pane out; what was beside it takes its room. */
export function removePane(
  layout: PaneLayout | undefined,
  pane: string,
): PaneLayout | undefined {
  return (layout && tidy(layout, (id) => id !== pane)) ?? undefined
}

/**
 * Docks `pane` against an edge of `target`, sharing the target's room with
 * it. A pane already in the arrangement moves there.
 */
export function dockPane(
  layout: PaneLayout | undefined,
  pane: string,
  target: string,
  edge: PaneEdge,
  newId: () => string = () => crypto.randomUUID(),
): PaneLayout {
  const rest = removePane(layout, pane)
  if (!rest || pane === target || !layoutPanes(rest).includes(target))
    return append(rest ?? null, pane, newId)
  const direction = directionOf(edge)
  const before = edge === 'left' || edge === 'top'
  const leaf = { pane }
  const pair = (node: PaneLayout) => (before ? [leaf, node] : [node, leaf])
  const place = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node))
      return node.pane === target
        ? { id: newId(), direction, children: pair(node) }
        : node
    const sizes = shares(node)
    const index = node.children.findIndex((c) => isLeaf(c) && c.pane === target)
    // Beside the target in a split that already runs this way.
    if (index >= 0 && node.direction === direction) {
      const half = sizes[index] / 2
      const at = before ? index : index + 1
      const children = [...node.children]
      children.splice(at, 0, leaf)
      return splitOf(node, children, [
        ...sizes.slice(0, index),
        half,
        half,
        ...sizes.slice(index + 1),
      ])
    }
    return splitOf(node, node.children.map(place), sizes)
  }
  return place(rest)
}

/** Trades the places of two panes, each taking the other's size. */
export function swapPanes(
  layout: PaneLayout | undefined,
  a: string,
  b: string,
): PaneLayout | undefined {
  if (!layout) return layout
  const other = (pane: string) => (pane === a ? b : pane === b ? a : pane)
  const swap = (node: PaneLayout): PaneLayout =>
    isLeaf(node)
      ? { pane: other(node.pane) }
      : splitOf(node, node.children.map(swap), shares(node))
  return swap(layout)
}

/** Records the sizes a split was dragged to. */
export function resizeSplit(
  layout: PaneLayout | undefined,
  splitId: string,
  sizes: Record<string, number>,
): PaneLayout | undefined {
  const resize = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node)) return node
    if (node.id !== splitId)
      return { ...node, children: node.children.map(resize) }
    const next = node.children.map((c) => sizes[layoutKey(c)])
    return next.every((size) => size > 0)
      ? splitOf(node, node.children, next)
      : node
  }
  return layout && resize(layout)
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Where each pane sits, in percent of the workspace. */
function paneRects(layout: PaneLayout): Map<string, Rect> {
  const rects = new Map<string, Rect>()
  const walk = (node: PaneLayout, rect: Rect) => {
    if (isLeaf(node)) {
      rects.set(node.pane, rect)
      return
    }
    let offset = 0
    shares(node).forEach((share, i) => {
      const row = node.direction === 'row'
      const size = ((row ? rect.width : rect.height) * share) / 100
      walk(
        node.children[i],
        row
          ? { ...rect, x: rect.x + offset, width: size }
          : { ...rect, y: rect.y + offset, height: size },
      )
      offset += size
    })
  }
  walk(layout, { x: 0, y: 0, width: 100, height: 100 })
  return rects
}

/** The pane touching `pane` on that edge, the one sharing most of it. */
export function paneNeighbor(
  layout: PaneLayout | undefined,
  pane: string,
  edge: PaneEdge,
): string | undefined {
  if (!layout) return undefined
  const rects = paneRects(layout)
  const from = rects.get(pane)
  if (!from) return undefined
  const row = directionOf(edge) === 'row'
  const start = (r: Rect) => (row ? r.x : r.y)
  const end = (r: Rect) => (row ? r.x + r.width : r.y + r.height)
  const overlap = (r: Rect) =>
    row
      ? Math.min(r.y + r.height, from.y + from.height) - Math.max(r.y, from.y)
      : Math.min(r.x + r.width, from.x + from.width) - Math.max(r.x, from.x)
  const before = edge === 'left' || edge === 'top'
  let best: { id: string; shared: number } | undefined
  for (const [id, rect] of rects) {
    if (id === pane) continue
    const gap = before ? start(from) - end(rect) : start(rect) - end(from)
    const shared = overlap(rect)
    if (Math.abs(gap) > 0.01 || shared <= 0.01) continue
    if (!best || shared > best.shared + 0.01) best = { id, shared }
  }
  return best?.id
}

/** The panes and their arrangement, matched to the open files. */
export function normalizeWorkspace(
  stored: {
    panes?: ReadonlyArray<FilePaneGroup>
    layout?: PaneLayout
  },
  openIds: ReadonlyArray<string>,
  activeId: string | null,
) {
  const panes = normalizePanes(stored.panes, openIds, activeId)
  const layout = normalizeLayout(
    stored.layout,
    panes.map((p) => p.id),
  )
  const order = layoutPanes(layout)
  panes.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  return { panes, layout }
}
