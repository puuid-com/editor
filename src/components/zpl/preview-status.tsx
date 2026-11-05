import { IconAlertTriangle, IconMinus, IconPlus } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'

import { selectFile, setSettings, zplStore } from './store'
import { ZOOM_STEPS } from './use-preview-zoom'
import type { PreviewZoom } from './store'
import type { LabelRender } from './use-label-render'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { LabelaryError } from '#/lib/zpl/labelary'
import {
  DEFAULT_SETTINGS,
  MAX_SIZE_IN,
  MIN_SIZE_IN,
  dotsToInches,
  labelDots,
} from '#/lib/zpl/settings'
import type { LabelSettings, ZplSize } from '#/lib/zpl/settings'
import { m } from '#/paraglide/messages'

export function ZoomControls({
  zoom,
  scale,
  onZoomChange,
}: {
  zoom: PreviewZoom
  /** The zoom in effect, which fitting the pane works out. */
  scale: number
  onZoomChange: (zoom: PreviewZoom) => void
}) {
  const percent = Math.round(scale * 100)
  const larger = ZOOM_STEPS.find((step) => step > scale * 1.01)
  const smaller = ZOOM_STEPS.filter((step) => step < scale * 0.99).at(-1)

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.zpl_zoom_out()}
        className="text-muted-foreground"
        disabled={smaller === undefined}
        onClick={() => smaller && onZoomChange(smaller)}
      >
        <IconMinus />
      </Button>
      <span
        aria-label={m.zpl_zoom_level({ percent })}
        className="min-w-10 text-center"
      >
        {m.zpl_zoom_percent({ percent })}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.zpl_zoom_in()}
        className="text-muted-foreground"
        disabled={larger === undefined}
        onClick={() => larger && onZoomChange(larger)}
      >
        <IconPlus />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={zoom === 'fit'}
        className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
        onClick={() => onZoomChange('fit')}
      >
        {m.zpl_zoom_fit_short()}
      </Button>
    </div>
  )
}

export function StatusLine({
  panelId,
  render,
  isRendering,
  error,
  onRetry,
  otherPanel,
  children,
}: {
  panelId: string
  render: LabelRender | undefined
  isRendering: boolean
  error: Error | null
  onRetry: () => void
  /** The panel being compared with, once its render is available. */
  otherPanel?: { name: string; labelCount: number }
  /** Controls at the end of the line. */
  children?: React.ReactNode
}) {
  const settings = useSelector(
    zplStore,
    (state) => selectFile(state, panelId)?.settings ?? DEFAULT_SETTINGS,
  )
  const labels = render?.labels ?? []
  const problems = render?.warnings.length ?? 0
  const zplSize = render ? zplSizeSettings(render.zplSize, settings) : null

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end gap-2 text-xs text-muted-foreground tabular-nums *:pointer-events-auto">
      <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-0.5 has-[>*:not(:empty)]:border has-[>*:not(:empty)]:bg-background">
        {zplSize && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSettings(panelId, zplSize)}
              >
                <IconAlertTriangle data-icon="inline-start" />
                {m.zpl_zpl_size_differs({
                  width: zplSize.widthIn,
                  height: zplSize.heightIn,
                })}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{m.zpl_use_zpl_size()}</TooltipContent>
          </Tooltip>
        )}
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          {error ? (
            <span className="flex items-center gap-2">
              <span className="text-destructive">
                {error instanceof LabelaryError && error.status === 429
                  ? m.zpl_render_rate_limited()
                  : m.zpl_render_failed({ message: error.message })}
              </span>
              <Button variant="outline" size="xs" onClick={onRetry}>
                {m.zpl_retry()}
              </Button>
            </span>
          ) : null}
          {render && render.total > labels.length && (
            <span>
              {m.zpl_status_first_labels({
                shown: labels.length,
                count: render.total,
              })}
            </span>
          )}
          {problems > 0 && (
            <span className="text-foreground">
              {problems === 1
                ? m.zpl_status_one_problem()
                : m.zpl_status_many_problems({ count: problems })}
            </span>
          )}
          {otherPanel && otherPanel.labelCount !== labels.length && (
            <span className="text-foreground">
              {otherPanel.labelCount === 1
                ? m.zpl_compare_panel_one_label({ name: otherPanel.name })
                : m.zpl_compare_panel_many_labels({
                    name: otherPanel.name,
                    count: otherPanel.labelCount,
                  })}
            </span>
          )}
          {isRendering && <span>{m.zpl_status_rendering()}</span>}
        </div>
      </div>
      <div className="ml-auto flex h-7 shrink-0 items-center rounded-md border bg-background px-0.5">
        {children}
      </div>
    </div>
  )
}

/**
 * The settings that would render at the size the ZPL's ^PW / ^LL ask for,
 * or null when they already do. A side the ZPL leaves out keeps its size.
 */
function zplSizeSettings(
  zplSize: ZplSize,
  settings: LabelSettings,
): Pick<LabelSettings, 'widthIn' | 'heightIn'> | null {
  const dots = labelDots(settings)
  const width = zplSize.width ?? dots.width
  const height = zplSize.height ?? dots.height
  if (width === dots.width && height === dots.height) return null
  // Three decimals round back to the same dots even at 600 dpi.
  const inches = (value: number) =>
    Math.min(
      Math.max(
        Number(dotsToInches(value, settings.dpmm).toFixed(3)),
        MIN_SIZE_IN,
      ),
      MAX_SIZE_IN,
    )
  return { widthIn: inches(width), heightIn: inches(height) }
}
