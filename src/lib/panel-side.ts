import type { PaneEdge } from '#/lib/store/pane-layout'

/** Where the side panel sits beside the code: picked, or by the room there is. */
export type PanelSide = 'auto' | PaneEdge

export const PANEL_SIDES: ReadonlyArray<PanelSide> = [
  'auto',
  'right',
  'bottom',
  'left',
  'top',
]

/** A pane at least this wide has room for its panel beside the code. */
export const ROOMY_WIDTH = 640

/** The edge of the code the side panel docks on. */
export function panelEdge(
  side: PanelSide,
  {
    roomy,
    phone = false,
    wideContent = false,
    above = false,
  }: {
    /** The pane is wide enough to put the two side by side. */
    roomy: boolean
    /** One narrow column: the two can only stack. */
    phone?: boolean
    /** The panel holds wide tables, which read better under the code. */
    wideContent?: boolean
    /** Stacked, the panel goes over the code instead of under it. */
    above?: boolean
  },
): PaneEdge {
  const stacked = above ? 'top' : 'bottom'
  if (phone) {
    if (side === 'top' || side === 'bottom') return side
    return side === 'left' ? 'top' : side === 'right' ? 'bottom' : stacked
  }
  if (side !== 'auto') return side
  return roomy && !wideContent ? 'right' : stacked
}
