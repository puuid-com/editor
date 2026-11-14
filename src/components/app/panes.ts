import { sessionStore } from '#/lib/store/session'
import { openFileIds } from '#/lib/store/files'
import {
  MAX_PANES,
  dockPane,
  movePaneTab,
  normalizeWorkspace,
  paneNeighbor,
  removePane,
  resizeSplit,
  swapPanes,
} from '#/lib/store/pane-layout'
import type {
  FilePaneGroup,
  PaneEdge,
  PaneLayout,
} from '#/lib/store/pane-layout'

export { MAX_PANES }

/** Where a dragged tab or pane lands in a pane: an edge, or the pane itself. */
export type PaneZone = PaneEdge | 'center'

function current() {
  const s = sessionStore.state
  return normalizeWorkspace(s, openFileIds(), s.activeId)
}

/** Saves the panes, in the reading order of their arrangement. */
export function savePanes(
  panes: Array<FilePaneGroup>,
  activeId = sessionStore.state.activeId,
  layout = sessionStore.state.layout,
) {
  const next = normalizeWorkspace(
    { panes, layout },
    panes.flatMap((p) => p.fileIds),
    null,
  )
  sessionStore.setState((s) => ({
    ...s,
    ...next,
    // One pane left has nothing to be maximized over.
    zoomed: next.panes.length > 1 && !!s.zoomed,
    activeId,
  }))
}

/** A tab's own new pane, docked against `target`. */
function splitOff(
  { panes, layout }: ReturnType<typeof current>,
  fileId: string,
  target: string,
  edge: PaneEdge,
) {
  const id = crypto.randomUUID()
  // The new pane shows, even if another was maximized.
  setZoomed(false)
  savePanes(
    movePaneTab([...panes, { id, fileIds: [], activeId: fileId }], fileId, id),
    fileId,
    dockPane(layout, id, target, edge),
  )
}

/** Splits a tab into its own pane, on that edge of the pane it was in. */
export function openBeside(fileId: string, edge: PaneEdge = 'right') {
  const now = current()
  const source = now.panes.find((p) => p.fileIds.includes(fileId))
  if (!source) return
  if (source.fileIds.length === 1) {
    savePanes(now.panes, fileId, now.layout)
    return
  }
  if (now.panes.length >= MAX_PANES) return
  splitOff(now, fileId, source.id, edge)
}

export function moveTab(fileId: string, targetId: string, beforeId?: string) {
  const { panes, layout } = current()
  if (
    !panes.some((p) => p.fileIds.includes(fileId)) ||
    !panes.some((p) => p.id === targetId)
  )
    return
  savePanes(movePaneTab(panes, fileId, targetId, beforeId), fileId, layout)
}

/** Whether a tab dragged over `zone` of the pane `targetId` can land there. */
export function canDropTab(fileId: string, targetId: string, zone: PaneZone) {
  const { panes } = current()
  const source = panes.find((p) => p.fileIds.includes(fileId))
  if (!source || !panes.some((p) => p.id === targetId)) return false
  if (zone === 'center') return source.id !== targetId
  // A pane's only tab takes the pane with it; any other needs a new one.
  return source.fileIds.length === 1
    ? source.id !== targetId
    : panes.length < MAX_PANES
}

/** Drops a tab on a pane: into its tabs, or beside it as a pane of its own. */
export function dropTab(fileId: string, targetId: string, zone: PaneZone) {
  if (!canDropTab(fileId, targetId, zone)) return
  if (zone === 'center') return moveTab(fileId, targetId)
  const now = current()
  const source = now.panes.find((p) => p.fileIds.includes(fileId))
  if (source?.fileIds.length === 1)
    savePanes(
      now.panes,
      fileId,
      dockPane(now.layout, source.id, targetId, zone),
    )
  else splitOff(now, fileId, targetId, zone)
}

/** Drops a pane on another: against one of its edges, or into its tabs. */
export function dropPane(paneId: string, targetId: string, zone: PaneZone) {
  const { panes, layout } = current()
  const source = panes.find((p) => p.id === paneId)
  const target = panes.find((p) => p.id === targetId)
  if (!source || !target || source === target) return
  if (zone === 'center') return mergePane(paneId, targetId)
  savePanes(panes, undefined, dockPane(layout, paneId, targetId, zone))
}

/** Trades places with the pane on that edge. */
export function swapPane(paneId: string, edge: PaneEdge) {
  const { panes, layout } = current()
  const other = paneNeighbor(layout, paneId, edge)
  if (other) savePanes(panes, undefined, swapPanes(layout, paneId, other))
}

/** Puts every tab back in one pane, in pane order, keeping the active file. */
export function joinPanes() {
  const { panes } = current()
  if (panes.length < 2) return
  const fileIds = panes.flatMap((p) => p.fileIds)
  const activeId = sessionStore.state.activeId
  const first = panes[0]
  savePanes(
    [
      {
        ...first,
        fileIds,
        activeId:
          activeId && fileIds.includes(activeId) ? activeId : first.activeId,
      },
    ],
    undefined,
    { pane: first.id },
  )
}

/** Moves a pane's tabs into `targetId` and takes the pane away. */
function mergePane(paneId: string, targetId: string) {
  const { panes, layout } = current()
  const closed = panes.find((p) => p.id === paneId)
  const target = panes.find((p) => p.id === targetId)
  if (!closed || !target || closed === target) return
  target.fileIds.push(...closed.fileIds)
  const activeId = sessionStore.state.activeId
  if (activeId && closed.fileIds.includes(activeId)) target.activeId = activeId
  savePanes(
    panes.filter((p) => p !== closed),
    undefined,
    removePane(layout, paneId),
  )
}

/** Closing a pane merges its tabs into its neighbour, preserving every file. */
export function hidePane(paneId: string) {
  const { panes } = current()
  const index = panes.findIndex((p) => p.id === paneId)
  if (panes.length < 2 || index < 0) return
  mergePane(paneId, panes[index === 0 ? 1 : index - 1].id)
}

/** Keeps the sizes a split's panes were dragged to. */
export function saveSplitSizes(splitId: string, sizes: Record<string, number>) {
  sessionStore.setState((s) => {
    const layout = resizeSplit(s.layout, splitId, sizes)
    return same(layout, s.layout) ? s : { ...s, layout }
  })
}

/** Shows the focused pane alone, or every pane again. */
export function setZoomed(zoomed: boolean) {
  sessionStore.setState((s) => (!s.zoomed === !zoomed ? s : { ...s, zoomed }))
}

/** Whether two arrangements are the same, sizes within a hair. */
function same(a: PaneLayout | undefined, b: PaneLayout | undefined) {
  const round = (_: string, value: unknown) =>
    typeof value === 'number' ? Math.round(value * 10) / 10 : value
  return JSON.stringify(a, round) === JSON.stringify(b, round)
}
