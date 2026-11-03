import { sessionStore, setActive } from '#/lib/store/session'

export const MAX_PANES = 4

/** Keep the active file visible, replacing the last pane when switching tabs. */
export function visiblePanes(
  ids: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
  activeId: string,
) {
  const visible = [...new Set(ids)]
    .filter((id) => openIds.includes(id))
    .slice(0, MAX_PANES)
  if (visible.includes(activeId)) return visible
  if (visible.length === 0) return [activeId]
  return [...visible.slice(0, -1), activeId]
}

export function openBeside(fileId: string) {
  const { activeId, paneIds = [] } = sessionStore.state
  const ids = paneIds.length ? paneIds : activeId ? [activeId] : []
  if (!ids.includes(fileId) && ids.length >= MAX_PANES) return
  sessionStore.setState((s) => ({
    ...s,
    paneIds: [...new Set([...ids, fileId])],
  }))
  setActive(fileId)
}

export function hidePane(fileId: string) {
  const ids = (sessionStore.state.paneIds ?? []).filter((id) => id !== fileId)
  if (!ids.length) return
  sessionStore.setState((s) => ({
    ...s,
    paneIds: ids,
    activeId: s.activeId === fileId ? ids[0] : s.activeId,
  }))
}
