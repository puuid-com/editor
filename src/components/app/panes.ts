import { sessionStore } from '#/lib/store/session'
import { filesCollection } from '#/lib/store/files'
import { MAX_PANES, movePaneTab, normalizePanes } from '#/lib/store/pane-layout'
import type { FilePaneGroup } from '#/lib/store/pane-layout'

export { MAX_PANES, normalizePanes }

function currentPanes() {
  const s = sessionStore.state
  const openIds = [...filesCollection.values()]
    .filter((f) => f.deletedAt === null)
    .sort((a, b) => a.order - b.order)
    .map((f) => f.id)
  return normalizePanes(s.panes, openIds, s.activeId)
}

export function savePanes(
  panes: Array<FilePaneGroup>,
  activeId = sessionStore.state.activeId,
) {
  sessionStore.setState((s) => ({ ...s, panes, activeId }))
}

/** Split a tab into its own group without duplicating its editor. */
export function openBeside(fileId: string) {
  const panes = currentPanes()
  const source = panes.find((p) => p.fileIds.includes(fileId))
  if (!source) return
  if (source.fileIds.length === 1) {
    savePanes(panes, fileId)
    return
  }
  if (panes.length >= MAX_PANES) return
  const targetId = crypto.randomUUID()
  const target = { id: targetId, fileIds: [], activeId: fileId }
  const index = panes.findIndex((p) => p.id === source.id)
  panes.splice(index + 1, 0, target)
  savePanes(movePaneTab(panes, fileId, targetId), fileId)
}

export function moveTab(fileId: string, targetId: string, beforeId?: string) {
  const panes = currentPanes()
  if (
    !panes.some((p) => p.fileIds.includes(fileId)) ||
    !panes.some((p) => p.id === targetId)
  )
    return
  savePanes(movePaneTab(panes, fileId, targetId, beforeId), fileId)
}

/** Puts every tab back in one pane, in pane order, keeping the active file. */
export function joinPanes() {
  const panes = currentPanes()
  if (panes.length < 2) return
  const fileIds = panes.flatMap((p) => p.fileIds)
  const activeId = sessionStore.state.activeId
  const first = panes[0]
  savePanes([
    {
      ...first,
      fileIds,
      activeId:
        activeId && fileIds.includes(activeId) ? activeId : first.activeId,
    },
  ])
}

/** Closing a pane merges its tabs into its neighbour, preserving every file. */
export function hidePane(paneId: string) {
  const panes = currentPanes()
  const index = panes.findIndex((p) => p.id === paneId)
  if (panes.length < 2 || index < 0) return
  const [closed] = panes.splice(index, 1)
  const target = panes[Math.max(0, index - 1)]
  target.fileIds.push(...closed.fileIds)
  const activeId = sessionStore.state.activeId
  if (activeId && closed.fileIds.includes(activeId)) target.activeId = activeId
  savePanes(panes)
}
