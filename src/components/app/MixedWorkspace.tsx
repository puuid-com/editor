import { ImagePreview } from '#/components/image/ImagePreview'
import {
  Fragment,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSelector } from '@tanstack/react-store'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { editorPrefs } from '#/components/editor/word-wrap'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { useElementSize } from '#/hooks/use-element-size'
import { useFileContent, useFileKind } from '#/hooks/use-files'
import type { WorkspaceFile } from '#/hooks/use-files'
import { ROOMY_WIDTH, panelEdge } from '#/lib/panel-side'
import { sessionStore, setActive } from '#/lib/store/session'
import { setSettingsActive, settingsPane, settingsTab } from './settings-tab'
import { SidePanel } from './SidePanel'
import {
  canDropTab,
  dropPane,
  dropTab,
  savePanes,
  saveSplitSizes,
} from './panes'
import { endPaneDrag, paneDrag } from './pane-drag'
import { PanelFrame } from './PanelFrame'
import { PanelSplit } from './PanelSplit'
import { AppHeader } from './AppHeader'
import { lazyPart } from '#/lib/lazy'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { PasteBar } from './PasteBar'
import { layoutKey, normalizeWorkspace } from '#/lib/store/pane-layout'
import type { FilePaneGroup, PaneLayout } from '#/lib/store/pane-layout'
import type { PaneZone } from './panes'

const SettingsPage = lazyPart(() =>
  import('./on-demand').then((mod) => mod.SettingsPage),
)
const ZplPane = lazy(() =>
  import('#/components/zpl/ZplPane').then((mod) => ({ default: mod.ZplPane })),
)
const ZplHeaderActions = lazy(() =>
  import('#/components/zpl/header-actions').then((mod) => ({
    default: mod.ZplHeaderActions,
  })),
)
const ZplMenuItems = lazy(() =>
  import('#/components/zpl/header-actions').then((mod) => ({
    default: mod.ZplMenuItems,
  })),
)
const MarkdownPreview = lazy(() =>
  import('#/components/markdown/MarkdownPreview').then((mod) => ({
    default: mod.MarkdownPreview,
  })),
)
const CompareView = lazy(() =>
  import('#/components/compare/CompareView').then((mod) => ({
    default: mod.CompareView,
  })),
)

export function MixedWorkspace({
  files,
  fileId,
  compareId,
  wide,
}: {
  /** The open tabs. */
  files: Array<WorkspaceFile>
  fileId: string
  compareId: string | null
  wide: boolean
}) {
  const storedPanes = useSelector(sessionStore, (s) => s.panes)
  const storedLayout = useSelector(sessionStore, (s) => s.layout)
  const zoomed = useSelector(sessionStore, (s) => !!s.zoomed)
  const { panes, layout } = useMemo(
    () =>
      normalizeWorkspace(
        { panes: storedPanes, layout: storedLayout },
        files.map((f) => f.id),
        fileId,
      ),
    [storedPanes, storedLayout, files, fileId],
  )
  useEffect(() => {
    const { panes: saved, layout: arranged } = sessionStore.state
    // The session moved on after this render, as when the last of several
    // imported files is picked right after it: these panes were worked out
    // from what it held before, and saving them would undo that. The render
    // it set off works from what it holds now.
    if (saved !== storedPanes || arranged !== storedLayout) return
    if (
      JSON.stringify(panes) !== JSON.stringify(saved) ||
      JSON.stringify(layout) !== JSON.stringify(arranged)
    )
      savePanes(panes, undefined, layout)
  }, [panes, layout, storedPanes, storedLayout])
  // A drag that ends anywhere, such as outside the window, is over.
  useEffect(() => {
    document.addEventListener('dragend', endPaneDrag)
    document.addEventListener('drop', endPaneDrag)
    return () => {
      document.removeEventListener('dragend', endPaneDrag)
      document.removeEventListener('drop', endPaneDrag)
    }
  }, [])

  // Phones show one pane, and so does a pane that was maximized.
  const alone = !wide || zoomed || panes.length < 2
  const settings = useSelector(settingsTab, (s) => s)
  const shown = panes.find((p) => p.fileIds.includes(fileId)) ?? panes.at(0)
  const settingsId = !settings.open
    ? null
    : alone
      ? shown?.id
      : settingsPane(settings.paneId, panes, fileId)?.id
  const pane = (paneId: string) => {
    const group = panes.find((p) => p.id === paneId)
    if (!group) return null
    return (
      <FilePane
        files={files}
        pane={group}
        active={group.activeId === fileId}
        compareId={group.activeId === fileId ? compareId : null}
        wide={wide}
        settings={settingsId === group.id}
        settingsActive={settingsId === group.id && settings.active}
        count={panes.length}
        first={alone || group.id === panes[0].id}
        zoomed={wide && zoomed && panes.length > 1}
      />
    )
  }
  if (alone || !layout) return shown ? pane(shown.id) : null
  return <Arrangement layout={layout} pane={pane} />
}

/** The panes laid out in their rows and columns, a handle between each. */
function Arrangement({
  layout,
  pane,
}: {
  layout: PaneLayout
  pane: (paneId: string) => React.ReactNode
}) {
  if ('pane' in layout) return pane(layout.pane)
  return (
    <ResizablePanelGroup
      id={layout.id}
      orientation={layout.direction === 'row' ? 'horizontal' : 'vertical'}
      defaultLayout={layout.sizes}
      onLayoutChanged={(sizes) => saveSplitSizes(layout.id, sizes)}
    >
      {layout.children.map((child, index) => (
        <Fragment key={layoutKey(child)}>
          {index > 0 && <ResizableHandle />}
          <ResizablePanel id={layoutKey(child)} minSize="15%">
            <Arrangement layout={child} pane={pane} />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  )
}

/** An image file, read whole only here: the pane above needs just its kind. */
function ImagePane({ fileId, active }: { fileId: string; active: boolean }) {
  const file = useFileContent(fileId)
  if (!file) return null
  return (
    <ImagePreview
      key={file.content}
      file={{ ...file, id: fileId }}
      active={active}
    />
  )
}

function FilePane({
  files,
  pane,
  active,
  compareId,
  wide,
  settings,
  settingsActive,
  count,
  first,
  zoomed,
}: {
  files: Array<WorkspaceFile>
  pane: FilePaneGroup
  active: boolean
  compareId: string | null
  wide: boolean
  /** The settings tab sits in this pane. */
  settings: boolean
  /** The settings page shows in place of the pane's file. */
  settingsActive: boolean
  count: number
  /** The first pane in reading order, which holds the sheet's own buttons. */
  first: boolean
  /** The pane was maximized over the others. */
  zoomed: boolean
}) {
  const fileId = pane.activeId
  const file = useFileKind(fileId)
  const language = file?.language ?? 'xml'
  const image = !!file?.image
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const live = useSelector(editorPrefs, (s) => s.markdownLive)
  const side = useSelector(editorPrefs, (s) => s.panelSide)
  const markdown = language === 'md'
  const zpl = language === 'zpl'
  // ZPL has its own label preview; SQL and plain text have nothing to show
  // beside them, and live Markdown renders in the editor itself.
  const hasPanel =
    !image &&
    !zpl &&
    language !== 'sql' &&
    language !== 'txt' &&
    !(markdown && live)
  const showPanel = active && panelOpen && hasPanel && !!file?.hasContent
  const [sizeRef, size] = useElementSize<HTMLElement>()
  const edge = panelEdge(side, {
    // Until it's measured, a pane alone on a wide screen has the room.
    roomy: size.width ? size.width >= ROOMY_WIDTH : wide && count === 1,
    phone: !wide,
    // A flat file's records are wide tables.
    wideContent: language === 'flat',
    // A label reads first, so stacked it goes over its code.
    above: zpl,
  })
  // Opening another file here, from the sidebar or a new tab, shows it.
  const shownId = useRef(fileId)
  useEffect(() => {
    if (shownId.current !== fileId && settings) setSettingsActive(false)
    shownId.current = fileId
  }, [fileId, settings])
  return (
    <section
      ref={sizeRef}
      aria-label={file?.name}
      className="flex h-full min-w-0 flex-col"
      onPointerDownCapture={() => setActive(fileId)}
      onFocusCapture={() => setActive(fileId)}
    >
      <AppHeader
        paneId={pane.id}
        fileId={fileId}
        files={
          wide
            ? pane.fileIds.flatMap((id) => files.find((f) => f.id === id) ?? [])
            : files
        }
        allFiles={files}
        active={active}
        count={count}
        first={first}
        zoomed={zoomed}
        wide={wide}
        hasPanel={hasPanel}
        movablePanel={hasPanel || zpl}
        settings={settings}
        settingsActive={settingsActive}
        actions={
          zpl && (
            <Suspense>
              <ZplHeaderActions fileId={fileId} />
            </Suspense>
          )
        }
        menuItems={
          zpl && (
            <Suspense>
              <ZplMenuItems fileId={fileId} />
            </Suspense>
          )
        }
      />
      {!image && !settingsActive && <PasteBar fileId={fileId} />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {settingsActive && (
          <div className="min-h-0 flex-1">
            <Suspense>
              <SettingsPage />
            </Suspense>
          </div>
        )}
        {/* The file stays mounted under the settings page, to keep its place. */}
        <div className={cn('min-h-0 flex-1', settingsActive && 'hidden')}>
          {image ? (
            <ImagePane fileId={fileId} active={active} />
          ) : zpl ? (
            <Suspense>
              <div className={compareId ? 'hidden h-full' : 'h-full'}>
                <ZplPane fileId={fileId} edge={edge} />
              </div>
              {compareId && (
                <CompareView
                  fileId={fileId}
                  otherId={compareId}
                  layout={wide ? 'split' : 'unified'}
                />
              )}
            </Suspense>
          ) : (
            <PanelSplit
              edge={edge}
              // Markdown gets a live preview, every other type its structure.
              kind={markdown ? 'preview' : 'structure'}
              panelClassName={markdown ? undefined : 'bg-muted/20'}
              panel={
                showPanel &&
                (markdown ? (
                  <PanelFrame title={m.md_preview()} edge={edge}>
                    <Suspense>
                      <MarkdownPreview fileId={fileId} />
                    </Suspense>
                  </PanelFrame>
                ) : (
                  <SidePanel edge={edge} />
                ))
              }
            >
              <Suspense>
                <div className={compareId ? 'hidden h-full' : 'h-full'}>
                  <CodeEditor fileId={fileId} />
                </div>
                {compareId && (
                  <CompareView
                    fileId={fileId}
                    otherId={compareId}
                    layout={wide ? 'split' : 'unified'}
                  />
                )}
              </Suspense>
            </PanelSplit>
          )}
        </div>
        {wide && !zoomed && <DropZones paneId={pane.id} />}
      </div>
    </section>
  )
}

/** Where the highlight sits for each place a drag can land. */
const ZONE: Record<PaneZone, string> = {
  center: 'inset-1',
  left: 'inset-y-1 left-1 w-[calc(50%-0.25rem)]',
  right: 'inset-y-1 right-1 w-[calc(50%-0.25rem)]',
  top: 'inset-x-1 top-1 h-[calc(50%-0.25rem)]',
  bottom: 'inset-x-1 bottom-1 h-[calc(50%-0.25rem)]',
}

/** Near an edge, a drag docks there; in the middle, it joins the pane. */
function zoneAt(event: React.DragEvent): PaneZone {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  const edges = [
    ['left', x],
    ['right', 1 - x],
    ['top', y],
    ['bottom', 1 - y],
  ] as const
  const [edge, distance] = edges.reduce((a, b) => (b[1] < a[1] ? b : a))
  return distance < 0.3 ? edge : 'center'
}

/**
 * Covers a pane while a tab or a pane is dragged, and shows where it would
 * land: the half of the pane on the nearest edge, or the whole pane to join
 * its tabs.
 */
function DropZones({ paneId }: { paneId: string }) {
  const drag = useSelector(paneDrag, (s) => s)
  const [zone, setZone] = useState<PaneZone | null>(null)
  if (!drag) return null
  const lands = (at: PaneZone) =>
    drag.kind === 'tab' ? canDropTab(drag.id, paneId, at) : drag.id !== paneId
  return (
    <div
      className="absolute inset-0 z-30"
      onDragOver={(event) => {
        const at = zoneAt(event)
        if (!lands(at)) return setZone(null)
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setZone(at)
      }}
      onDragLeave={() => setZone(null)}
      onDrop={(event) => {
        const at = zoneAt(event)
        setZone(null)
        if (!lands(at)) return
        event.preventDefault()
        if (drag.kind === 'tab') dropTab(drag.id, paneId, at)
        else dropPane(drag.id, paneId, at)
      }}
    >
      {zone && (
        <div
          className={cn(
            'pointer-events-none absolute rounded-md border border-ring bg-ring/15',
            ZONE[zone],
          )}
        />
      )}
    </div>
  )
}
