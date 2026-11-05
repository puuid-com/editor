import { useId, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { LabelFigure, PAIR_GAP } from './label-figure'
import { StatusLine, ZoomControls } from './preview-status'
import {
  selectFile,
  setCompareTarget,
  setPreviewZoom,
  zoomStore,
  zplStore,
} from './store'
import { useOtherPanelRender } from './use-label-render'
import { ZOOM_STEPS, usePreviewZoom } from './use-preview-zoom'
import type { CompareMode, Compared, View } from './label-figure'
import type { LabelRender } from './use-label-render'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useElementSize } from '#/hooks/use-element-size'
import { DIFF_COLORS, rgb } from '#/lib/zpl/diff'
import { m } from '#/paraglide/messages'

const VIEWPORT_PADDING = 24
/** Room under the labels for the status and zoom controls floating over the preview. */
const OVERLAY_HEIGHT = 32
/** A figure's caption line and the gap above it. */
const CAPTION_HEIGHT = 16 + 8
/** A side-by-side column's title line and the gap below it. */
const COLUMN_TITLE_HEIGHT = 16 + 6

interface LabelPreviewProps {
  panelId: string
  render: LabelRender | undefined
  isRendering: boolean
  error: Error | null
  onRetry: () => void
  /** The panel to compare with, if any. */
  compareTarget: string | null
}

export function LabelPreview({
  panelId,
  render,
  isRendering,
  error,
  onRetry,
  compareTarget: target,
}: LabelPreviewProps) {
  const headingId = useId()
  const zoom = useSelector(zoomStore, (zooms) => zooms[panelId] ?? 'fit')
  const syncZoom = useSelector(zplStore, (state) => state.syncZoom)
  const [viewportRef, viewport, viewportElement] =
    useElementSize<HTMLDivElement>()
  const localName = useSelector(
    zplStore,
    (state) => `${selectFile(state, panelId)?.fileName ?? ''}.zpl`,
  )
  const remoteName = useSelector(zplStore, (state) =>
    target ? `${selectFile(state, target)?.fileName ?? ''}.zpl` : '',
  )
  const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side')
  const view: View = target ? compareMode : 'single'
  const other = useOtherPanelRender(target ?? undefined)

  const compared: Compared | undefined = target
    ? {
        labels: other.render?.labels ?? [],
        stale: other.isStale,
        placeholder: m.zpl_compare_no_panel_label({ name: remoteName }),
        localTitle: localName,
        remoteTitle: remoteName,
        onlyLocal: m.zpl_diff_only({ name: localName }),
        onlyRemote: m.zpl_diff_only({ name: remoteName }),
      }
    : undefined

  const labels = render?.labels ?? []
  // Another panel's labels may be bigger, and a difference overlay is as
  // big as the larger label of the pair.
  const sized = [...labels, ...(compared?.labels.slice(0, labels.length) ?? [])]
  const widest = Math.max(1, ...sized.map((label) => label.width))
  const tallest = Math.max(1, ...sized.map((label) => label.height))
  const columns = view === 'side-by-side' ? 2 : 1
  // Only the labels are centered, not their captions: as much room as a
  // caption takes below the labels is kept above them, side-by-side column
  // titles included.
  const titleHeight = view === 'side-by-side' ? COLUMN_TITLE_HEIGHT : 0
  const captionBalance = CAPTION_HEIGHT - titleHeight
  const chromeHeight = CAPTION_HEIGHT * 2
  // Fit shows each label whole, so the pane only scrolls between labels.
  // Rounded down so a fraction of a pixel never brings in a scrollbar.
  // With nothing to fit, a new empty panel would read "Zoom 60000%".
  const fitScale =
    labels.length === 0
      ? 1
      : Math.max(
          ZOOM_STEPS[0],
          Math.floor(
            Math.min(
              (viewport.width -
                VIEWPORT_PADDING * 2 -
                PAIR_GAP * (columns - 1)) /
                (widest * columns),
              (viewport.height -
                VIEWPORT_PADDING * 2 -
                OVERLAY_HEIGHT -
                chromeHeight) /
                tallest,
            ) * 1000,
          ) / 1000,
        )
  const scale = zoom === 'fit' ? fitScale : zoom

  usePreviewZoom({
    panelId,
    viewportElement,
    viewportHeight: viewport.height,
    scale,
    hasLabels: labels.length > 0,
    syncZoom,
  })

  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full min-w-0 flex-col"
    >
      <h3 id={headingId} className="sr-only">
        {m.zpl_preview_label()}
      </h3>

      {compared && (
        <CompareBar
          mode={compareMode}
          onModeChange={setCompareMode}
          compared={compared}
          onClose={() => setCompareTarget(panelId, null)}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={viewportRef}
          className="min-h-0 flex-1 overflow-auto overscroll-none bg-muted"
        >
          {labels.length === 0 ? (
            <div className="preview-empty-state flex min-h-full flex-col">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle className="text-base font-medium">
                    {m.zpl_empty_preview_title()}
                  </EmptyTitle>
                  <EmptyDescription className="max-w-64 text-inherit">
                    {m.zpl_empty_preview()}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              <p className="px-6 pb-6 text-center text-xs">
                <a
                  href="https://labelary.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-current/40 underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  {m.zpl_empty_preview_credit()}
                </a>
              </p>
            </div>
          ) : (
            <div
              className="flex min-h-full w-max min-w-full flex-col items-center justify-center gap-6"
              style={{
                // The overlay's room is split above and below, so a label
                // that fits sits in the middle and still clears the controls.
                // Its caption's room is matched above it.
                paddingInline: VIEWPORT_PADDING,
                paddingTop:
                  VIEWPORT_PADDING + OVERLAY_HEIGHT / 2 + captionBalance,
                paddingBottom: VIEWPORT_PADDING + OVERLAY_HEIGHT / 2,
              }}
            >
              {labels.map((label, index) => (
                <LabelFigure
                  key={index}
                  view={view}
                  caption={m.zpl_label_caption({
                    index: index + 1,
                    count: render?.total ?? labels.length,
                  })}
                  label={label}
                  remote={compared?.labels.at(index)}
                  compared={compared}
                  scale={scale}
                />
              ))}
            </div>
          )}
        </div>

        <StatusLine
          panelId={panelId}
          render={render}
          isRendering={isRendering}
          error={error}
          onRetry={onRetry}
          otherPanel={
            target && other.render
              ? {
                  name: remoteName,
                  labelCount: other.render.labels.length,
                }
              : undefined
          }
        >
          <ZoomControls
            zoom={zoom}
            scale={scale}
            onZoomChange={(next) => setPreviewZoom(panelId, next)}
          />
        </StatusLine>
      </div>
    </section>
  )
}

function CompareBar({
  mode,
  onModeChange,
  compared,
  onClose,
}: {
  mode: CompareMode
  onModeChange: (mode: CompareMode) => void
  compared: Compared
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={mode}
        // Radix reports an empty value when the pressed item is pressed again.
        onValueChange={(value) => {
          if (value) onModeChange(value as CompareMode)
        }}
        aria-label={m.zpl_compare_view()}
      >
        <ToggleGroupItem value="side-by-side">
          {m.zpl_compare_side_by_side()}
        </ToggleGroupItem>
        <ToggleGroupItem value="difference">
          {m.zpl_compare_difference()}
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === 'difference' && (
        <DiffLegend
          onlyLocal={compared.onlyLocal}
          onlyRemote={compared.onlyRemote}
        />
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.compare_close()}
        className="ml-auto text-muted-foreground"
        onClick={onClose}
      >
        <IconX />
      </Button>
    </div>
  )
}

function DiffLegend({
  onlyLocal,
  onlyRemote,
}: {
  onlyLocal: string
  onlyRemote: string
}) {
  const entries = [
    [DIFF_COLORS.both, m.zpl_diff_both()],
    [DIFF_COLORS.onlyA, onlyLocal],
    [DIFF_COLORS.onlyB, onlyRemote],
  ] as const

  return (
    <ul
      aria-label={m.zpl_diff_legend()}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
    >
      {entries.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 ring-1 ring-border"
            style={{ backgroundColor: rgb(color) }}
          />
          {label}
        </li>
      ))}
    </ul>
  )
}
