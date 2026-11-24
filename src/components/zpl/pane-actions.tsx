import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'

import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '#/components/ui/dropdown-menu'
import { exportAs } from '#/lib/zpl/export'
import { DEFAULT_FILE_NAME } from '#/lib/zpl/file-name'
import { m } from '#/paraglide/messages'
import { notify } from '#/components/app/notice-store'
import { DownloadDialog } from './download-dialog'
import {
  compareStore,
  zplStore,
  selectFile,
  setCompareTarget,
  setExplain,
  zplCandidates,
} from './store'
import { labelRenderQuery, useOtherPanelRender } from './use-label-render'

/**
 * Asks for a name, then downloads the label as a PDF or PNG, rendered as the
 * preview shows it. Mounted afresh for each download.
 */
export function ZplExportDialog({
  fileId,
  format,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  fileId: string
  format: 'pdf' | 'png'
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const labelCount = useOtherPanelRender(fileId).render?.labels.length ?? 0
  const queryClient = useQueryClient()
  const [defaultName] = useState(
    () => selectFile(zplStore.state, fileId)?.fileName ?? DEFAULT_FILE_NAME,
  )

  const download = async (baseName: string) => {
    // The live source, not the debounced one the preview shows.
    const panel = selectFile(zplStore.state, fileId)
    if (!panel?.source.trim()) return
    // Unchanged since the preview caught up, this is the render it shows.
    const { labels } = await queryClient.fetchQuery(
      labelRenderQuery(panel.source, panel.settings),
    )
    await exportAs(format, panel.source, labels, baseName)
  }

  return (
    <DownloadDialog
      open={open}
      onOpenChange={onOpenChange}
      format={format}
      defaultName={defaultName}
      labelCount={labelCount}
      onDownload={(baseName) =>
        void download(baseName).catch(() => notify.error(m.zpl_action_failed()))
      }
      returnFocusRef={returnFocusRef}
    />
  )
}

/** ZPL entries for the pane's ⋯ menu: what to compare with and the editor's explanations. */
export function ZplMenuItems({ fileId }: { fileId: string }) {
  const explain = useSelector(zplStore, (s) => s.explain)
  const files = useSelector(zplStore, (s) => s.files)
  const candidates = zplCandidates({ files }, fileId)
  const target = useSelector(compareStore, (s) => s[fileId])
  const value = candidates.some((f) => f.id === target) ? target : 'none'

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={candidates.length === 0}>
          {m.zpl_compare()}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) =>
              setCompareTarget(fileId, next === 'none' ? null : next)
            }
          >
            <DropdownMenuRadioItem value="none">
              {m.zpl_compare_none()}
            </DropdownMenuRadioItem>
            {candidates.map((f) => (
              <DropdownMenuRadioItem key={f.id} value={f.id}>
                {f.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuCheckboxItem checked={explain} onCheckedChange={setExplain}>
        {m.zpl_explain()}
      </DropdownMenuCheckboxItem>
    </>
  )
}
