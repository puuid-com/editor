import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-store'
import { zplHelpCompartment } from './editor-support'
import { setDiagnostics } from '@codemirror/lint'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { getFileView } from '#/components/editor/editor-store'
import { fileIdField } from '#/components/editor/extensions'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { languageOf } from '#/lib/document'
import { sessionStore } from '#/lib/store/session'
import { dpiFor } from '#/lib/zpl/settings'
import { m } from '#/paraglide/messages'
import { LabelPreview } from './label-preview'
import { SettingsPopover } from './settings-popover'
import { PanelToolbar } from './toolbar'
import { editorStore, selectFile, setExplain, setSyncZoom } from './store'
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
  const syncZoom = useSelector(editorStore, (s) => s.syncZoom)
  const active = useSelector(sessionStore, (s) => s.activeId === fileId)
  const [target, setTarget] = useState('none')
  const candidates = files.filter(
    (f) =>
      f.id !== fileId &&
      f.deletedAt === null &&
      languageOf(f.name, f.content) === 'zpl',
  )
  const compareTarget = candidates.some((f) => f.id === target) ? target : null
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

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <SettingsPopover panelId={fileId}>
          <Button variant="ghost" size="xs">
            {m.zpl_settings()}
          </Button>
        </SettingsPopover>
        <PanelToolbar
          panelId={fileId}
          labelCount={render?.labels.length ?? 0}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <Button
          variant="ghost"
          size="xs"
          aria-pressed={explain}
          onClick={() => setExplain(!explain)}
        >
          {m.zpl_explain()}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          aria-pressed={syncZoom}
          onClick={() => setSyncZoom(!syncZoom)}
        >
          {m.zpl_sync_zoom()}
        </Button>
        <Select value={compareTarget ?? 'none'} onValueChange={setTarget}>
          <SelectTrigger
            size="sm"
            className="ml-auto max-w-48 text-xs"
            aria-label={m.zpl_compare()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{m.zpl_compare_none()}</SelectItem>
            {candidates.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="border-b px-2 py-1 text-xs text-muted-foreground">
        {m.zpl_privacy()}
      </p>
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          key={sideBySide ? 'horizontal' : 'vertical'}
          orientation={sideBySide ? 'horizontal' : 'vertical'}
        >
          <ResizablePanel
            id="zpl-code"
            defaultSize={sideBySide ? '50%' : '45%'}
            minSize="20%"
          >
            <CodeEditor fileId={fileId} />
          </ResizablePanel>
          <ResizableHandle />
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
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
