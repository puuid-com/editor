import { persistedStore } from './persist'

/**
 * How much of its pane each side panel was dragged to, in percent, by kind
 * and by whether it sits beside the code or stacked with it.
 */
export const panelSizes = persistedStore<Record<string, number>>(
  'panel-sizes',
  () => localStorage,
  {},
)

export function savePanelSize(key: string, size: number) {
  panelSizes.setState((s) => (s[key] === size ? s : { ...s, [key]: size }))
}
