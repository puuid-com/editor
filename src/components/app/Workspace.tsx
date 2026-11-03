import { useSelector } from '@tanstack/react-store'
import { Suspense, lazy, useEffect } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'

import { SidePanel } from './SidePanel'
import { setMobileView, uiStore } from './ui-store'
import { CodeEditor } from '#/components/editor/CodeEditor'
import { editorStore } from '#/components/editor/editor-store'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useFileEmpty } from '#/hooks/use-files'
import { sessionStore } from '#/lib/store/session'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// The diff package is only needed while comparing, so it loads on first use.
const CompareView = lazy(() =>
  import('#/components/compare/CompareView').then((mod) => ({
    default: mod.CompareView,
  })),
)

interface WorkspaceProps {
  fileId: string
  /** Tab to compare with, shown in place of the editor. */
  compareId: string | null
}

/**
 * The editor, or a comparison in its place. The editor stays mounted while
 * hidden, so its state, undo history and the toolbar keep working.
 */
function EditorOrCompare({
  fileId,
  compareId,
  layout,
}: WorkspaceProps & { layout: 'split' | 'unified' }) {
  return (
    <>
      <div className={cn('h-full', compareId && 'hidden')}>
        <CodeEditor fileId={fileId} />
      </div>
      {compareId && (
        <Suspense>
          <CompareView fileId={fileId} otherId={compareId} layout={layout} />
        </Suspense>
      )}
    </>
  )
}

export function DesktopWorkspace({ fileId, compareId }: WorkspaceProps) {
  // An empty file has no structure to show, and SQL is only formatted.
  const empty = useFileEmpty(fileId)
  const sql = useSelector(editorStore, (s) => s.doc.language === 'sql')
  const panelOpen =
    useSelector(sessionStore, (s) => s.panelOpen) && !empty && !sql
  const layout = useDefaultLayout({
    id: 'xml-main-h',
    panelIds: panelOpen ? ['editor', 'side'] : ['editor'],
  })

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <ResizablePanel id="editor" minSize="25">
        <EditorOrCompare fileId={fileId} compareId={compareId} layout="split" />
      </ResizablePanel>
      {panelOpen && (
        <>
          <ResizableHandle />
          <ResizablePanel
            id="side"
            defaultSize="36"
            minSize="20"
            className="bg-muted/20"
          >
            <SidePanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  )
}

export function MobileWorkspace({ fileId, compareId }: WorkspaceProps) {
  // Nothing to show beside an empty file or a SQL one.
  const sql = useSelector(editorStore, (s) => s.doc.language === 'sql')
  const editorOnly = useFileEmpty(fileId) || sql
  const view = useSelector(uiStore, (s) =>
    editorOnly ? 'editor' : s.mobileView,
  )
  useEffect(() => setMobileView('editor'), [fileId])

  return (
    <Tabs
      value={view}
      onValueChange={(value) =>
        setMobileView(value === 'structure' ? 'structure' : 'editor')
      }
      className="h-full min-h-0 gap-0"
    >
      <TabsList
        variant="line"
        aria-label={m.workspace_views()}
        className={cn(
          'h-11! w-full shrink-0 border-b p-0',
          editorOnly && 'hidden',
        )}
      >
        <TabsTrigger value="editor" className="h-full! text-sm after:bottom-0!">
          {m.nav_editor()}
        </TabsTrigger>
        <TabsTrigger
          value="structure"
          className="h-full! text-sm after:bottom-0!"
        >
          {m.panel_structure()}
        </TabsTrigger>
      </TabsList>
      {/* Keep CodeMirror alive so tree edits, selection and undo still work. */}
      <TabsContent
        value="editor"
        forceMount
        className="min-h-0 overflow-hidden data-[state=inactive]:hidden"
      >
        <EditorOrCompare
          fileId={fileId}
          compareId={compareId}
          layout="unified"
        />
      </TabsContent>
      <TabsContent
        value="structure"
        forceMount
        className="min-h-0 overflow-hidden bg-muted/20 data-[state=inactive]:hidden"
      >
        <SidePanel />
      </TabsContent>
    </Tabs>
  )
}
