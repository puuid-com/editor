import { useSelector } from '@tanstack/react-store'
import { useEffect, useEffectEvent, useId, useRef } from 'react'
import { usePanelRef } from 'react-resizable-panels'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { panelSizes, savePanelSize } from '#/lib/store/panel-sizes'
import type { PaneEdge } from '#/lib/store/pane-layout'

/** What a side panel shows; each kind keeps its own size. */
type PanelKind = 'structure' | 'preview' | 'label'

/** The panel's share of the pane until it's dragged, in percent. */
const DEFAULT_SIZE: Record<PanelKind, { beside: number; stacked: number }> = {
  structure: { beside: 36, stacked: 36 },
  preview: { beside: 50, stacked: 50 },
  label: { beside: 50, stacked: 55 },
}

/**
 * The code with its side panel docked on one edge, a handle between them.
 * The panel keeps the size it was dragged to, one beside the code and one
 * stacked with it.
 */
export function PanelSplit({
  edge,
  kind,
  panel,
  panelClassName,
  children,
}: {
  /** The edge of the code the panel sits on. */
  edge: PaneEdge
  kind: PanelKind
  /** The panel, or nothing while it's closed. */
  panel: React.ReactNode
  panelClassName?: string
  /** The code. */
  children: React.ReactNode
}) {
  const beside = edge === 'left' || edge === 'right'
  const first = edge === 'left' || edge === 'top'
  const sizeKey = `${kind}:${beside ? 'beside' : 'stacked'}`
  const size =
    useSelector(panelSizes, (s) => s[sizeKey] as number | undefined) ??
    DEFAULT_SIZE[kind][beside ? 'beside' : 'stacked']
  const panelRef = usePanelRef()
  // Panels put their id on the page, and every pane has this pair.
  const id = useId()
  const panelId = `${id}panel`
  // Turning from beside to stacked keeps the group: give the panel the size
  // it had that way round.
  const shown = useRef(beside)
  const restoreSize = useEffectEvent(() => {
    panelRef.current?.resize(`${size}%`)
  })
  useEffect(() => {
    if (shown.current === beside) return
    shown.current = beside
    restoreSize()
  }, [beside])

  const main = (
    <ResizablePanel key="code" id={`${id}code`} minSize="25%">
      {children}
    </ResizablePanel>
  )
  const side = panel ? (
    <ResizablePanel
      key="panel"
      id={panelId}
      panelRef={panelRef}
      defaultSize={`${size}%`}
      minSize="15%"
      className={panelClassName}
    >
      {panel}
    </ResizablePanel>
  ) : null
  const handle = panel ? <ResizableHandle key="handle" /> : null

  return (
    <ResizablePanelGroup
      // Panels can't trade places in a group, so it starts over.
      key={first ? 'panel-first' : 'code-first'}
      orientation={beside ? 'horizontal' : 'vertical'}
      onLayoutChanged={(layout, meta) => {
        if (meta.isUserInteraction && layout[panelId] > 0)
          savePanelSize(sizeKey, layout[panelId])
      }}
    >
      {first ? [side, handle, main] : [main, handle, side]}
    </ResizablePanelGroup>
  )
}
