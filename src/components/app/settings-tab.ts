import { Store } from '@tanstack/store'

import { sessionStore } from '#/lib/store/session'
import type { FilePaneGroup } from '#/lib/store/pane-layout'

// Settings open as a tab beside the files, in one pane. While it's the
// picked tab, the page shows in place of that pane's file.

export type SettingsSection =
  'general' | 'format' | 'defaults' | 'variables' | 'profiles'

interface SettingsTabState {
  open: boolean
  /** Shown in its pane; false while one of the pane's files is picked. */
  active: boolean
  /** The pane it opened in. */
  paneId: string | null
  section: SettingsSection
}

export const settingsTab = new Store<SettingsTabState>({
  open: false,
  active: false,
  paneId: null,
  section: 'general',
})

const paneOf = (panes: ReadonlyArray<FilePaneGroup>, fileId: string | null) =>
  panes.find((p) => p.fileIds.includes(fileId ?? ''))

/** Opens the tab, or picks it, in the focused pane unless it's open already. */
export function openSettings(section?: SettingsSection) {
  const { panes = [], activeId } = sessionStore.state
  settingsTab.setState((s) => ({
    open: true,
    active: true,
    paneId: s.open ? s.paneId : (paneOf(panes, activeId)?.id ?? null),
    section: section ?? s.section,
  }))
}

export function closeSettings() {
  settingsTab.setState((s) => ({ ...s, open: false, active: false }))
}

/** Picks the tab (true) or one of its pane's files (false). */
export function setSettingsActive(active: boolean) {
  settingsTab.setState((s) => (s.active === active ? s : { ...s, active }))
}

export function setSettingsSection(section: SettingsSection) {
  settingsTab.setState((s) => ({ ...s, section }))
}

/**
 * The pane the tab sits in: the one it opened in while that's still there,
 * otherwise the focused one.
 */
export function settingsPane(
  paneId: string | null,
  panes: ReadonlyArray<FilePaneGroup>,
  activeId: string | null,
) {
  return (
    panes.find((p) => p.id === paneId) ?? paneOf(panes, activeId) ?? panes.at(0)
  )
}
