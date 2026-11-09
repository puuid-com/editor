import { ImagePreview } from '#/components/image/ImagePreview'
import { imageMime, isImageData } from '#/lib/image-file'
import { Fragment, Suspense, lazy, useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { editorPrefs } from '#/components/editor/word-wrap'
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
import { PasteBar } from './PasteBar'
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
  const panes = normalizePanes(
    stored,
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
  const image = !!file && (!!imageMime(file.name) || isImageData(file.content))
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const live = useSelector(editorPrefs, (s) => s.markdownLive)
  const files = useOpenFiles()
  const markdown = language === 'md'
  // ZPL has its own label preview; SQL and plain text have nothing to show
  // beside them, and live Markdown renders in the editor itself.
  const hasPanel =
    !image &&
    language !== 'zpl' &&
    language !== 'sql' &&
    language !== 'txt' &&
    !(markdown && live)
  const showPanel = active && panelOpen && hasPanel && !!file?.content
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
        hasPanel={hasPanel}
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
      {!image && <PasteBar fileId={fileId} />}
      <div className="min-h-0 flex-1">
        {image ? (
          <ImagePreview
            key={file.content}
            file={{ ...file, id: fileId }}
            active={active}
          />
        ) : (
          <>
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
                      <ZplPane
                        fileId={fileId}
                        sideBySide={wide && count === 1}
                      />
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
              {showPanel && (
                <>
                  <ResizableHandle />
                  {/* Markdown gets a live preview, every other type its
                  structure. */}
                  {markdown ? (
                    <ResizablePanel
                      id="preview"
                      defaultSize="50%"
                      minSize="20%"
                    >
                      <Suspense>
                        <MarkdownPreview fileId={fileId} />
                      </Suspense>
                    </ResizablePanel>
                  ) : (
                    <ResizablePanel
                      id="structure"
                      defaultSize="36%"
                      minSize="20%"
                      className="bg-muted/20"
                    >
                      <SidePanel />
                    </ResizablePanel>
                  )}
                </>
              )}
            </ResizablePanelGroup>
          </>
        )}
      </div>
    </section>
  )
}
