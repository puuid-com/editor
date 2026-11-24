import { Suspense, lazy, useRef, useState } from 'react'
import {
  IconBinary,
  IconClipboard,
  IconDownload,
  IconFileTypePdf,
  IconLink,
  IconPhoto,
} from '@tabler/icons-react'

import { ToolbarButton } from './ToolbarButton'
import { setShareOpen } from './ui-store'
import {
  copyFile,
  copyFileBase64,
  downloadFile,
} from '#/components/editor/actions'
import { exportMarkdownPdf } from '#/components/markdown/pdf/export-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { downloadName } from '#/lib/document'
import type { DocLanguage } from '#/lib/document'
import { m } from '#/paraglide/messages'

const ZplExportDialog = lazy(() =>
  import('#/components/zpl/pane-actions').then((mod) => ({
    default: mod.ZplExportDialog,
  })),
)

/**
 * The same menu on every pane: download the file, copy it as text or base64,
 * or share a link to it, plus its type's own exports, like a note or a label
 * as PDF.
 */
export function DownloadMenu({
  fileId,
  file,
  onOpen,
}: {
  fileId: string
  file: {
    name: string
    language: DocLanguage
    image: boolean
    hasContent: boolean
  }
  /** Makes the pane's file the active one, which sharing works on. */
  onOpen: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Bumped per label download, so each dialog starts fresh.
  const [label, setLabel] = useState({
    id: 0,
    open: false,
    format: 'pdf' as 'pdf' | 'png',
  })
  const empty = !file.hasContent
  const askLabel = (format: 'pdf' | 'png') =>
    setLabel((current) => ({ id: current.id + 1, open: true, format }))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            ref={triggerRef}
            label={m.download_menu()}
            hint={m.download_file({
              name: downloadName(file.name, file.language),
            })}
            size="icon-sm"
            className="shrink-0"
            onClick={onOpen}
          >
            <IconDownload />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            disabled={empty}
            onSelect={() => downloadFile(fileId)}
          >
            <IconDownload />
            <span className="truncate">
              {m.download_file({
                name: downloadName(file.name, file.language),
              })}
            </span>
          </DropdownMenuItem>
          {file.language === 'md' && (
            <DropdownMenuItem
              disabled={empty}
              onSelect={() => exportMarkdownPdf({ kind: 'file', id: fileId })}
            >
              <IconFileTypePdf />
              {m.download_pdf()}
            </DropdownMenuItem>
          )}
          {file.language === 'zpl' && (
            <>
              <DropdownMenuItem
                disabled={empty}
                onSelect={() => askLabel('pdf')}
              >
                <IconFileTypePdf />
                {m.download_pdf()}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={empty}
                onSelect={() => askLabel('png')}
              >
                <IconPhoto />
                {m.download_png()}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {!file.image && (
            <>
              <DropdownMenuItem
                disabled={empty}
                onSelect={() => void copyFile(fileId)}
              >
                <IconClipboard />
                {m.file_copy()}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={empty}
                onSelect={() => void copyFileBase64(fileId)}
              >
                <IconBinary />
                {m.file_copy_base64()}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              onOpen()
              setShareOpen(true)
            }}
          >
            <IconLink />
            {m.share_copy()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {label.id > 0 && (
        <Suspense>
          <ZplExportDialog
            key={label.id}
            fileId={fileId}
            format={label.format}
            open={label.open}
            onOpenChange={(open) => setLabel((c) => ({ ...c, open }))}
            returnFocusRef={triggerRef}
          />
        </Suspense>
      )}
    </>
  )
}
