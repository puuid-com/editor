import { useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { zplHelpCompartment } from './editor-support'
import { setDiagnostics } from '@codemirror/lint'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { getFileView } from '#/components/editor/editor-store'
import { fileIdField } from '#/components/editor/extensions'
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { sessionStore } from '#/lib/store/session'
import { dpiFor } from '#/lib/zpl/settings'
import { LabelPreview } from './label-preview'
import { compareStore, editorStore, selectFile, zplCandidates } from './store'
import { useLabelRender } from './use-label-render'
import { zplHelp } from './zpl-language'

export function ZplPane({
  fileId,
  sideBySide = false,
}: {
  fileId: string
  sideBySide?: boolean
}) {
  const { render, isRendering, error, retry } = useLabelRender(fileId)
  const file = useSelector(editorStore, (s) => selectFile(s, fileId))
  const files = useSelector(editorStore, (s) => s.files)
  const explain = useSelector(editorStore, (s) => s.explain)
  const active = useSelector(sessionStore, (s) => s.activeId === fileId)
  const target = useSelector(compareStore, (s) => s[fileId])
  // A target that was closed or stopped being ZPL compares with nothing.
  const compareTarget =
    zplCandidates({ files }, fileId).find((f) => f.id === target)?.id ?? null
  const dpi = dpiFor(file?.settings.dpmm ?? 8)

  // The focused editor gets diagnostics; every visible preview renders independently.
  useEffect(() => {
    const view = getFileView(fileId)
    if (view?.state.field(fileIdField, false) !== fileId) return
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

  const code = (
    <ResizablePanel
      id="zpl-code"
      defaultSize={sideBySide ? '50%' : '45%'}
      minSize="20%"
    >
      <CodeEditor fileId={fileId} />
    </ResizablePanel>
  )
  // Stacked, the label sits on top and the code below it.
  const preview = (
    <ResizablePanel id="zpl-preview" minSize="20%">
      <LabelPreview
        panelId={fileId}
        render={render}
        isRendering={isRendering}
        error={error}
        onRetry={retry}
        compareTarget={compareTarget}
      />
    </ResizablePanel>
  )

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          key={sideBySide ? 'horizontal' : 'vertical'}
          orientation={sideBySide ? 'horizontal' : 'vertical'}
        >
          {sideBySide ? (
            <>
              {code}
              <ResizableHandle />
              {preview}
            </>
          ) : (
            <>
              {preview}
              <ResizableHandle />
              {code}
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
