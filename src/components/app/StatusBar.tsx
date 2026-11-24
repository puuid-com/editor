import { Suspense, lazy } from 'react'
import { useSelector } from '@tanstack/react-store'

import { ActionBar } from './ActionBar'
import { CenterMenu } from './CenterMenu'
import { MarkdownLiveToggle } from './MarkdownLiveToggle'
import { StatusNotice } from './StatusNotice'
import { editorStore } from '#/components/editor/editor-store'
import { HighlightsBar } from '#/components/highlights/HighlightsBar'
import { Separator } from '#/components/ui/separator'
import { useFileEmpty } from '#/hooks/use-files'
import { hasVariables, isPlain } from '#/lib/document'

const ZplStatusControls = lazy(() =>
  import('#/components/zpl/status-controls').then((mod) => ({
    default: mod.ZplStatusControls,
  })),
)

/**
 * Bottom bar of the workspace, laid out the same for every file type: the
 * draft's controls or highlights on the left, then the latest notice in the
 * free space; on the right the file's profile, variables and actions, then
 * the settings of its type, like a note's live preview or a label's size.
 */
export function StatusBar({
  leading,
  settings = false,
}: {
  /** Controls for the editor's state when there is no file, before the rest. */
  leading?: React.ReactNode
  /** The settings page covers the focused file: only notices show. */
  settings?: boolean
}) {
  const activeId = useSelector(editorStore, (s) => s.fileId)
  // An empty file has no type yet, so nothing to highlight, format or set up.
  const empty = useFileEmpty(activeId)
  const typed = !!activeId && !empty
  const language = useSelector(editorStore, (s) => s.doc.language)
  // Only XML, JSON and flat files have tags to highlight.
  const plain = isPlain(language)

  const footer =
    'flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-t px-1.5 text-[11px] whitespace-nowrap text-muted-foreground [scrollbar-width:none] md:h-9'
  if (settings)
    return (
      <footer className={footer}>
        <StatusNotice />
      </footer>
    )

  return (
    <footer className={footer}>
      {leading}
      {typed && !plain && <HighlightsBar />}
      <StatusNotice />
      {typed && hasVariables(language) && <ActionBar />}
      {typed && language === 'zpl' && (
        <>
          <Divider />
          <Suspense>
            <ZplStatusControls fileId={activeId} />
          </Suspense>
        </>
      )}
      {activeId && language === 'md' && (
        <>
          {typed && <Divider />}
          <MarkdownLiveToggle />
          <CenterMenu />
        </>
      )}
    </footer>
  )
}

/** A hairline between two groups of the bar's controls. */
function Divider() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 data-vertical:h-4 data-vertical:self-center"
    />
  )
}
