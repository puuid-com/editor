import { exportMarkdownPdf } from '#/components/markdown/pdf/PdfExportDialog'
import { Suspense, lazy } from 'react'
import { IconFileTypePdf } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { ActionBar, FormatButton } from './ActionBar'
import { CenterMenu } from './CenterMenu'
import { MarkdownLiveToggle } from './MarkdownLiveToggle'
import { StatusNotice } from './StatusNotice'
import { editorStore } from '#/components/editor/editor-store'
import { HighlightsBar } from '#/components/highlights/HighlightsBar'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { useFileEmpty } from '#/hooks/use-files'
import { isPlain } from '#/lib/document'
import { m } from '#/paraglide/messages'

const ZplStatusControls = lazy(() =>
  import('#/components/zpl/status-controls').then((mod) => ({
    default: mod.ZplStatusControls,
  })),
)

/** Bottom bar of the workspace: the draft's controls or highlights on the left, then the latest notice in the free space; the file's setup and actions (for ZPL, who renders labels and zoom sync) on the right. */
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
  // SQL, ZPL, Markdown and text have no highlights, defaults or variables;
  // SQL and Markdown's fenced code can still be formatted.
  const language = useSelector(editorStore, (s) => s.doc.language)
  const plain = isPlain(language)
  const zpl = language === 'zpl'
  const markdown = language === 'md'
  const sql = language === 'sql'

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
      {typed && (sql || markdown) && (
        <div className="flex items-center text-foreground">
          <FormatButton />
        </div>
      )}
      {typed && !plain && <ActionBar />}
      {typed && zpl && (
        <>
          <Divider />
          <Suspense>
            <ZplStatusControls fileId={activeId} />
          </Suspense>
        </>
      )}
      {activeId && markdown && (
        <>
          {typed && <Divider />}
          <MarkdownLiveToggle />
          <CenterMenu />
          <Button
            variant="ghost"
            size="xs"
            className="max-md:h-11"
            onClick={() => exportMarkdownPdf({ kind: 'file', id: activeId })}
          >
            <IconFileTypePdf />
            {m.md_pdf_export()}
          </Button>
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
