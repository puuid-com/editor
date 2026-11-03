import { Fragment, Suspense, lazy, useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { IconLayoutColumns, IconX } from '@tabler/icons-react'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { useOpenFiles, useFileContent } from '#/hooks/use-files'
import { languageOf } from '#/lib/document'
import { sessionStore, setActive } from '#/lib/store/session'
import { m } from '#/paraglide/messages'
import { SidePanel } from './SidePanel'
import { MAX_PANES, hidePane, openBeside, visiblePanes } from './panes'
import { newZplFile } from './files'

const ZplPane = lazy(() =>
  import('#/components/zpl/ZplPane').then((mod) => ({ default: mod.ZplPane })),
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
  const stored = useSelector(sessionStore, (s) => s.paneIds)
  const ids = visiblePanes(
    stored ?? [],
    files.map((f) => f.id),
    fileId,
  )
  const key = ids.join(',')
  useEffect(() => {
    if (key !== (sessionStore.state.paneIds ?? []).join(','))
      sessionStore.setState((s) => ({ ...s, paneIds: ids }))
  }, [key])
  const rendered = wide ? ids : [fileId]
  return (
    <ResizablePanelGroup orientation="horizontal">
      {rendered.map((id, index) => (
        <Fragment key={id}>
          {index > 0 && <ResizableHandle />}
          <ResizablePanel id={id} minSize="15%">
            <FilePane
              fileId={id}
              active={id === fileId}
              compareId={id === fileId ? compareId : null}
              wide={wide}
              count={ids.length}
            />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  )
}

function FilePane({
  fileId,
  active,
  compareId,
  wide,
  count,
}: {
  fileId: string
  active: boolean
  compareId: string | null
  wide: boolean
  count: number
}) {
  const file = useFileContent(fileId)
  const language = languageOf(file?.name ?? '', file?.content ?? '')
  const panelOpen = useSelector(sessionStore, (s) => s.panelOpen)
  const files = useOpenFiles()
  const visible = useSelector(sessionStore, (s) => s.paneIds ?? [])
  const showStructure =
    active &&
    panelOpen &&
    language !== 'zpl' &&
    language !== 'sql' &&
    !!file?.content
  return (
    <section
      aria-label={file?.name}
      className="flex h-full min-w-0 flex-col"
      onPointerDownCapture={() => setActive(fileId)}
      onFocusCapture={() => setActive(fileId)}
    >
      <div
        className="flex h-9 shrink-0 items-center gap-1 border-b px-2"
        data-active={active || undefined}
      >
        <Button
          variant="ghost"
          size="xs"
          className="min-w-0 flex-1 justify-start truncate"
          aria-pressed={active}
          onClick={() => setActive(fileId)}
        >
          {file?.name}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={m.pane_add()}>
              <IconLayoutColumns />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {files
              .filter((f) => !visible.includes(f.id))
              .map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  disabled={count >= MAX_PANES}
                  onSelect={() => openBeside(f.id)}
                >
                  {f.name}
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem
              onSelect={() => {
                const id = newZplFile()
                openBeside(id)
              }}
            >
              {m.file_new_zpl()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {count > 1 && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.pane_close()}
            onClick={() => hidePane(fileId)}
          >
            <IconX />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          orientation={wide && count === 1 ? 'horizontal' : 'vertical'}
        >
          <ResizablePanel id="code" minSize="25%">
            <Suspense>
              <div className={compareId ? 'hidden h-full' : 'h-full'}>
                {language === 'zpl' ? (
                  <ZplPane fileId={fileId} />
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
