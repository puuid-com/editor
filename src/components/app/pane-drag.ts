import { Store } from '@tanstack/store'

/** What a dragged tab carries: its file's id. */
export const TAB_DRAG = 'text/x-xml-tab'
/** What a dragged pane carries: its id. */
const PANE_DRAG = 'text/x-xml-pane'

/** A tab or a whole pane on its way to another place in the sheet. */
interface PaneDrag {
  kind: 'tab' | 'pane'
  id: string
}

/** The drag in progress. Panes show where it can land while there is one. */
export const paneDrag = new Store<PaneDrag | null>(null)

export function startPaneDrag(event: React.DragEvent, drag: PaneDrag) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(
    drag.kind === 'tab' ? TAB_DRAG : PANE_DRAG,
    drag.id,
  )
  // After the browser has taken its picture of what's dragged: Chrome drops
  // a drag whose page changes while it starts.
  setTimeout(() => paneDrag.setState(() => drag))
}

export function endPaneDrag() {
  // Past the timer above, for a drag let go as soon as it starts.
  setTimeout(() => paneDrag.setState(() => null))
}
