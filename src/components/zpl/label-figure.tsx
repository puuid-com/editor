import { useEffect, useMemo, useRef } from 'react'

import { diffInk } from '#/lib/zpl/diff'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import type { LabelaryLabel } from '#/lib/zpl/labelary'

/** Between the two labels when comparing side by side. */
export const PAIR_GAP = 16

export type CompareMode = 'side-by-side' | 'difference'
/** The panel's labels alone, or compared with another panel's. */
export type View = 'single' | CompareMode

/** Another panel's labels, and what to call both sides. */
export interface Compared {
  labels: readonly LabelaryLabel[]
  /** The labels are for older source and are being replaced. */
  stale: boolean
  /** Shown in place of a missing label. */
  placeholder: string
  localTitle: string
  remoteTitle: string
  onlyLocal: string
  onlyRemote: string
}

interface LabelFigureProps {
  view: View
  caption: string
  label: LabelaryLabel
  /** The label at the same position in the compared panel, if it has one. */
  remote: LabelaryLabel | undefined
  compared: Compared | undefined
  scale: number
}

export function LabelFigure({
  view,
  caption,
  label,
  remote,
  compared,
  scale,
}: LabelFigureProps) {
  if (view === 'difference' && remote && compared) {
    return (
      <DiffFigure
        caption={caption}
        label={label}
        remote={remote}
        remoteTitle={compared.remoteTitle}
        stale={compared.stale}
        scale={scale}
      />
    )
  }

  const surface = (
    <RasterSurface
      image={label.canvas}
      width={label.width}
      height={label.height}
      scale={scale}
    />
  )

  return (
    <figure className="flex flex-col items-center gap-2">
      {view === 'single' || !compared ? (
        surface
      ) : (
        <div className="flex items-start" style={{ gap: PAIR_GAP }}>
          <RenderColumn title={compared.localTitle}>{surface}</RenderColumn>
          <RenderColumn title={compared.remoteTitle}>
            {remote ? (
              <RasterSurface
                image={remote.canvas}
                width={remote.width}
                height={remote.height}
                scale={scale}
                className={cn(
                  'transition-opacity',
                  compared.stale && 'opacity-50',
                )}
              />
            ) : (
              <div
                data-zoom-anchor
                className="flex items-center justify-center border border-dashed p-4 text-center text-xs text-muted-foreground"
                style={{
                  width: label.width * scale,
                  height: label.height * scale,
                }}
              >
                {compared.placeholder}
              </div>
            )}
          </RenderColumn>
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">
        {view === 'difference' && compared
          ? `${caption} · ${compared.placeholder}`
          : caption}
      </figcaption>
    </figure>
  )
}

function DiffFigure({
  caption,
  label,
  remote,
  remoteTitle,
  stale,
  scale,
}: {
  caption: string
  label: LabelaryLabel
  remote: LabelaryLabel
  remoteTitle: string
  stale: boolean
  scale: number
}) {
  const diff = useMemo(
    () => drawInkDiff(label.canvas, remote.canvas),
    [label, remote],
  )
  const summary =
    diff.differing === 0
      ? m.zpl_diff_identical({ name: remoteTitle })
      : m.zpl_diff_summary({
          percent: formatPercent(diff.differing / diff.inked),
        })
  const sizesDiffer =
    remote.width !== label.width || remote.height !== label.height

  return (
    <figure className="flex flex-col items-center gap-2">
      <RasterSurface
        image={diff.canvas}
        width={diff.canvas.width}
        height={diff.canvas.height}
        scale={scale}
        className={cn('transition-opacity', stale && 'opacity-50')}
      />
      <figcaption className="text-xs text-muted-foreground">
        {caption} · {summary}
        {sizesDiffer && ` · ${m.zpl_diff_sizes_differ()}`}
      </figcaption>
    </figure>
  )
}

function RenderColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  )
}

/** A label image at the preview's zoom. */
function RasterSurface({
  image,
  width,
  height,
  scale,
  className,
}: {
  image: HTMLCanvasElement
  width: number
  height: number
  scale: number
  className?: string
}) {
  const canvasRef = useCanvasCopy(image)
  return (
    <div
      data-zoom-anchor
      className={cn(
        'relative bg-white shadow-sm ring-1 ring-border',
        className,
      )}
      style={{ width: width * scale, height: height * scale }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-hidden
        className="absolute inset-0 size-full"
        style={{ imageRendering: scale > 1 ? 'pixelated' : 'auto' }}
      />
    </div>
  )
}

/** Keeps a displayed canvas in sync with the one it shows. */
function useCanvasCopy(image: HTMLCanvasElement) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
  }, [image])
  return canvasRef
}

function drawInkDiff(local: HTMLCanvasElement, remote: HTMLCanvasElement) {
  const diff = diffInk(readPixels(local), readPixels(remote))
  const canvas = document.createElement('canvas')
  canvas.width = diff.width
  canvas.height = diff.height
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(diff.data, diff.width, diff.height), 0, 0)
  return { canvas, differing: diff.differing, inked: diff.inked }
}

function readPixels(canvas: HTMLCanvasElement) {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  if (!context) return { width, height, data: new Uint8ClampedArray(0) }
  return context.getImageData(0, 0, width, height)
}

const percentFormats = new Map<string, Intl.NumberFormat>()

function formatPercent(ratio: number) {
  const locale = getLocale()
  let format = percentFormats.get(locale)
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumSignificantDigits: 2,
    })
    percentFormats.set(locale, format)
  }
  return format.format(ratio)
}
