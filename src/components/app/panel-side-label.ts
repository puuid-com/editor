import { m } from '#/paraglide/messages'
import type { PanelSide } from '#/lib/panel-side'

/** What each place for the side panel is called. */
export const panelSideLabel = (side: PanelSide) =>
  ({
    auto: m.panel_position_auto,
    right: m.edge_right,
    bottom: m.edge_bottom,
    left: m.edge_left,
    top: m.edge_top,
  })[side]()
