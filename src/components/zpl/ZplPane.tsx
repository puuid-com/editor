import { useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { zplHelpCompartment } from './editor-support'
import { setDiagnostics } from '@codemirror/lint'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { getFileView } from '#/components/editor/editor-store'
import { PanelFrame } from '#/components/app/PanelFrame'
import { PanelSplit } from '#/components/app/PanelSplit'
import { sessionStore } from '#/lib/store/session'
import type { PaneEdge } from '#/lib/store/pane-layout'
import { dpiFor } from '#/lib/zpl/settings'
import { LabelPreview } from './label-preview'
import { m } from '#/paraglide/messages'
import { compareStore, zplStore, selectFile, zplCandidates } from './store'
import { useLabelRender } from './use-label-render'
import {
  explainLines,
  labelDpi,
  loadZplExplanations,
  zplHelp,
} from './zpl-language'

// Fetched with the pane, so they're there by the time its editor shows.
void loadZplExplanations().catch(() => undefined)

export function ZplPane({
  fileId,
  edge,
  showPanel,
}: {
  fileId: string
  /** The edge of the code the label preview sits on. */
  edge: PaneEdge
  /** The label preview is open, like any other side panel. */
  showPanel: boolean
}) {
  const { render, isRendering, error, retry } = useLabelRender(fileId)
  const file = useSelector(zplStore, (s) => selectFile(s, fileId))
  const explain = useSelector(zplStore, (s) => s.explain)
  const active = useSelector(sessionStore, (s) => s.activeId === fileId)
  const target = useSelector(compareStore, (s) => s[fileId])
  // A target that was closed or stopped being ZPL compares with nothing.
  // Read as an id, so edits to other files don't render this pane again.
  const compareTarget = useSelector(
    zplStore,
    (s) => zplCandidates(s, fileId).find((f) => f.id === target)?.id ?? null,
  )
  const dpi = dpiFor(file?.settings.dpmm ?? 8)

  // The focused editor gets diagnostics; every visible preview renders independently.
  useEffect(() => {
    const view = getFileView(fileId)
    if (!view) return
    // Only when they change: a reconfigure rebuilds the editor's whole setup,
    // and this runs on every edit.
    if (
      view.state.facet(labelDpi) !== dpi ||
      view.state.facet(explainLines) !== explain
    )
      view.dispatch({
        effects: zplHelpCompartment.reconfigure(zplHelp({ dpi, explain })),
      })
    const warnings =
      render?.source === view.state.doc.toString() ? render.warnings : []
    view.dispatch(
      setDiagnostics(
        view.state,
        warnings.map((w) => ({
          from: Math.min(w.from, view.state.doc.length),
          to: Math.min(Math.max(w.to, w.from), view.state.doc.length),
          severity: 'warning' as const,
          message: w.message,
          source: w.command,
        })),
      ),
    )
  }, [active, fileId, render, dpi, explain, file?.source])

  return (
    <PanelSplit
      edge={edge}
      kind="label"
      panel={
        showPanel && (
          <PanelFrame title={m.zpl_preview_label()} edge={edge}>
            <LabelPreview
              panelId={fileId}
              render={render}
              isRendering={isRendering}
              error={error}
              onRetry={retry}
              compareTarget={compareTarget}
            />
          </PanelFrame>
        )
      }
    >
      <CodeEditor fileId={fileId} />
    </PanelSplit>
  )
}
