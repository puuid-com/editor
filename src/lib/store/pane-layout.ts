/** A stable editor group, with its own ordered tabs and selected file. */
export interface FilePaneGroup {
  id: string
  fileIds: Array<string>
  activeId: string
}

export const MAX_PANES = 4

/** Restore old sessions, discard closed tabs, and place newly opened files. */
export function normalizePanes(
  stored: ReadonlyArray<FilePaneGroup> | undefined,
  legacy: ReadonlyArray<string>,
  openIds: ReadonlyArray<string>,
  activeId: string | null,
): Array<FilePaneGroup> {
  const seen = new Set<string>()
  const source =
    stored ??
    [...new Set(legacy)].map((id) => ({ id, fileIds: [id], activeId: id }))
  const panes = source.slice(0, MAX_PANES).flatMap((pane) => {
    const fileIds = pane.fileIds.filter((id) => {
      if (!openIds.includes(id) || seen.has(id)) return false
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
