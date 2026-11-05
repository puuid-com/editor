import { useRef, useState } from 'react'
import { IconAdjustmentsHorizontal, IconChevronDown } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { copyBase64, copyZpl, exportAs } from '#/lib/zpl/export'
import type { ExportFormat } from '#/lib/zpl/export'
import { DEFAULT_FILE_NAME } from '#/lib/zpl/file-name'
import { m } from '#/paraglide/messages'
import { notify } from '#/components/app/notice-store'
import { DownloadDialog } from './download-dialog'
import { SettingsPopover } from './settings-popover'
import { useCopyShareLink } from './share-link'
import {
  compareStore,
  zplStore,
  selectFile,
  setCompareTarget,
  setExplain,
  zplCandidates,
} from './store'
import { labelRenderQuery, useOtherPanelRender } from './use-label-render'

const DOWNLOADS: ReadonlyArray<{ format: ExportFormat; label: () => string }> =
  [
    { format: 'pdf', label: m.zpl_export_pdf },
    { format: 'png', label: m.zpl_export_png },
    { format: 'zpl', label: m.zpl_export_zpl },
  ]

/** A ZPL pane's own actions, in its tab row: label settings, then downloads and copies. */
export function ZplHeaderActions({ fileId }: { fileId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <SettingsPopover panelId={fileId}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.zpl_settings()}
          className="text-muted-foreground"
        >
          <IconAdjustmentsHorizontal />
        </Button>
      </SettingsPopover>
      <DownloadMenu fileId={fileId} />
    </div>
  )
}

function DownloadMenu({ fileId }: { fileId: string }) {
  const hasSource = useSelector(zplStore, (state) =>
    Boolean(selectFile(state, fileId)?.source.trim()),
  )
  const labelCount = useOtherPanelRender(fileId).render?.labels.length ?? 0
  const copyShareLink = useCopyShareLink(fileId)
  // The menu button gets focus back once the dialog closes.
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [dialog, setDialog] = useState({
    /** Bumped per prompt so each one starts fresh, even mid close animation. */
    id: 0,
    open: false,
    format: 'pdf' as ExportFormat,
    defaultName: DEFAULT_FILE_NAME,
  })
  // Exports read the live source, not the debounced one the preview shows.
  const livePanel = () => selectFile(zplStore.state, fileId)
  const queryClient = useQueryClient()

  const download = async (format: ExportFormat, baseName: string) => {
    const panel = livePanel()
    if (!panel?.source.trim()) return
    // Unchanged since the preview caught up, this is the render it shows.
    const labels =
      format === 'zpl'
        ? []
        : (
            await queryClient.fetchQuery(
              labelRenderQuery(panel.source, panel.settings),
            )
          ).labels
    await exportAs(format, panel.source, labels, baseName)
  }

  const copy = (action: () => Promise<void>) =>
    void action()
      .then(() => notify.success(m.zpl_copied()))
      .catch(() => notify.error(m.zpl_action_failed()))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={!hasSource}
          >
            {m.zpl_download()}
            <IconChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {DOWNLOADS.map(({ format, label }) => (
            <DropdownMenuItem
              key={format}
              onSelect={() =>
                setDialog((current) => ({
                  id: current.id + 1,
                  open: true,
                  format,
                  defaultName: livePanel()?.fileName ?? DEFAULT_FILE_NAME,
                }))
              }
            >
              {label()}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => copy(() => copyZpl(livePanel()?.source ?? ''))}
          >
            {m.zpl_copy_zpl()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => copy(() => copyBase64(livePanel()?.source ?? ''))}
          >
            {m.zpl_copy_base64()}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(copyShareLink)}>
            {m.zpl_copy_share_link()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DownloadDialog
        key={dialog.id}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        format={dialog.format}
        defaultName={dialog.defaultName}
        labelCount={labelCount}
        onDownload={(baseName) =>
          void download(dialog.format, baseName).catch(() =>
            notify.error(m.zpl_action_failed()),
          )
        }
        returnFocusRef={triggerRef}
      />
    </>
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
