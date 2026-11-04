import { Fragment, Suspense, lazy, useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { CodeEditor } from '#/components/editor/CodeEditor'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { useOpenFiles, useFileContent } from '#/hooks/use-files'
import { languageOf } from '#/lib/document'
import { sessionStore, setActive } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import { SidePanel } from './SidePanel'
import { normalizePanes, savePanes } from './panes'
import { AppHeader } from './AppHeader'
import type { FilePaneGroup } from '#/lib/store/pane-layout'

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
const CompareView = lazy(() =>
  import('#/components/compare/CompareView').then((mod) => ({
    default: mod.CompareView,
  })),
)

export function MixedWorkspace({
  fileId,
  compareId,
  wide,
}: {
  fileId: string
  compareId: string | null
  wide: boolean
}) {
  const files = useOpenFiles()
  const stored = useSelector(sessionStore, (s) => s.panes)
  const legacy = useSelector(sessionStore, (s) => s.paneIds)
  const panes = normalizePanes(
    stored,
    legacy ?? [],
    files.map((f) => f.id),
    fileId,
  )
  const key = JSON.stringify(panes)
  useEffect(() => {
    if (key !== JSON.stringify(sessionStore.state.panes)) savePanes(panes)
  }, [key])
  const rendered = wide
    ? panes
    : panes.filter((p) => p.fileIds.includes(fileId))
  return (
    <ResizablePanelGroup orientation="horizontal">
      {rendered.map((pane, index) => (
        <Fragment key={pane.id}>
          {index > 0 && <ResizableHandle />}
          <ResizablePanel id={pane.id} minSize="20%">
            <FilePane
              pane={pane}
              active={pane.activeId === fileId}
              compareId={pane.activeId === fileId ? compareId : null}
              wide={wide}
              count={panes.length}
              first={index === 0}
              last={index === rendered.length - 1}
            />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  )
}

function FilePane({
  pane,
  active,
  compareId,
  wide,
  count,
  first,
  last,
}: {
  pane: FilePaneGroup
  active: boolean
  compareId: string | null
  wide: boolean
  count: number
  first: boolean
  last: boolean
}) {
  const fileId = pane.activeId
  const file = useFileContent(fileId)
  const language = languageOf(file?.name ?? '', file?.content ?? '')
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const files = useOpenFiles()
  const showStructure =
    active &&
    panelOpen &&
    language !== 'zpl' &&
    language !== 'sql' &&
    !!file?.content
  return (
    <section
      aria-label={file?.name}
      className={cn(
        'flex h-full min-w-0 flex-col',
        // The active tab joins what sits right below it: a stacked ZPL
        // pane's label preview, else the editor.
        language === 'zpl' && !(wide && count === 1)
          ? '[--sheet:var(--muted)]'
          : '[--sheet:var(--background)]',
      )}
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
        last={last}
        wide={wide}
        structured={language !== 'zpl' && language !== 'sql'}
        actions={
          language === 'zpl' && (
            <Suspense>
              <ZplHeaderActions fileId={fileId} />
            </Suspense>
          )
        }
        menuItems={
          language === 'zpl' && (
            <Suspense>
              <ZplMenuItems fileId={fileId} />
            </Suspense>
          )
        }
      />
      <div className="min-h-0 flex-1">
        {/* A flat file's records are wide tables, so they always sit
            under the code. */}
        <ResizablePanelGroup
          orientation={
            wide && count === 1 && language !== 'flat'
              ? 'horizontal'
              : 'vertical'
          }
        >
          <ResizablePanel id="code" minSize="25%">
            <Suspense>
              <div className={compareId ? 'hidden h-full' : 'h-full'}>
                {language === 'zpl' ? (
                  <ZplPane fileId={fileId} sideBySide={wide && count === 1} />
                ) : (
                  <CodeEditor fileId={fileId} />
                )}
              </div>
              {compareId && (
                <CompareView
                  fileId={fileId}
                  otherId={compareId}
                  layout={wide ? 'split' : 'unified'}
                />
              )}
            </Suspense>
          </ResizablePanel>
          {showStructure && (
            <>
              <ResizableHandle />
              <ResizablePanel
                id="structure"
                defaultSize="36%"
                minSize="20%"
                className="bg-muted/20"
              >
                <SidePanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </section>
  )
}
