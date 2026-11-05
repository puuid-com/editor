import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'

import { setPreviewZoom } from './store'

export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
const MIN_ZOOM = ZOOM_STEPS[0]
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]
/** How fast pinching or ⌘/Ctrl+scrolling zooms, per pixel scrolled. */
const WHEEL_ZOOM_RATE = 0.01
/** The most one wheel event zooms, as a power of e, so a notch can't leap. */
const MAX_ZOOM_STEP = 0.3
/** Marks what stays under the pointer while zooming. */
const ZOOM_ANCHOR = '[data-zoom-anchor]'

/** Hears one preview scroll, to scroll the others along while zoom is synced. */
type ScrollListener = (source: string, left: number, top: number) => void
const scrollListeners = new Set<ScrollListener>()

/** Where the pointer was over an element, to keep it there while zooming. */
interface ZoomAnchor {
  element: Element
  /** The point as a fraction of the element's size. */
  fx: number
  fy: number
  /** The pointer, from the viewport's corner. */
  x: number
  y: number
}

/** Safari reports trackpad pinches as gestures rather than wheel events. */
interface GestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

/**
 * Zooms a label preview with a pinch or ⌘/Ctrl+scroll around the pointer,
 * keeps what was under it in place as the scale changes, and scrolls the
 * other previews along while zoom is synced.
 */
export function usePreviewZoom({
  panelId,
  viewportElement,
  viewportHeight,
  scale,
  hasLabels,
  syncZoom,
}: {
  panelId: string
  viewportElement: HTMLDivElement | null
  viewportHeight: number
  /** The zoom in effect, which fitting the pane works out. */
  scale: number
  /** Nothing to zoom while the preview is empty. */
  hasLabels: boolean
  syncZoom: boolean
}) {
  // Zooms not yet rendered: events can arrive faster than renders, and each
  // builds on the last.
  const pendingZoom = useRef<{
    scale: number
    anchor: ZoomAnchor | undefined
  } | null>(null)

  const zoomAt = (
    factor: number,
    clientX: number,
    clientY: number,
    pointerTarget: EventTarget | null,
  ) => {
    if (!viewportElement || !hasLabels) return
    const from = pendingZoom.current?.scale ?? scale
    const to = Math.min(Math.max(from * factor, MIN_ZOOM), MAX_ZOOM)
    if (to === from) return

    const box = viewportElement.getBoundingClientRect()
    const x = clientX - box.left
    const y = clientY - box.top
    const pending = pendingZoom.current?.anchor
    let anchor = pending && { ...pending, x, y }
    if (!anchor) {
      const element =
        (pointerTarget instanceof Element &&
          pointerTarget.closest(ZOOM_ANCHOR)) ||
        viewportElement.firstElementChild
      if (element) {
        const rect = element.getBoundingClientRect()
        anchor = {
          element,
          fx: (clientX - rect.left) / rect.width,
          fy: (clientY - rect.top) / rect.height,
          x,
          y,
        }
      }
    }
    pendingZoom.current = { scale: to, anchor }
    setPreviewZoom(panelId, to)
  }

  const pinching = useRef(false)
  const onWheel = useEffectEvent((event: WheelEvent) => {
    // A trackpad's scroll looks just like a mouse wheel's, so plain scrolling
    // scrolls. Browsers report a pinch as ctrl+wheel; ⌘+wheel zooms as well.
    if (!(event.ctrlKey || event.metaKey) || pinching.current) return
    event.preventDefault()
    const pixels =
      event.deltaY *
      (event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? viewportHeight
          : 1)
    const step = -pixels * WHEEL_ZOOM_RATE
    zoomAt(
      Math.exp(Math.min(Math.max(step, -MAX_ZOOM_STEP), MAX_ZOOM_STEP)),
      event.clientX,
      event.clientY,
      event.target,
    )
  })
  const onGesture = useEffectEvent((event: GestureEvent, factor: number) => {
    zoomAt(factor, event.clientX, event.clientY, event.target)
  })

  useEffect(() => {
    if (!viewportElement) return
    // Safari's gesture scale counts from the start of the pinch.
    let gestureScale = 1
    const wheel = (event: WheelEvent) => onWheel(event)
    const gestureStart = (event: Event) => {
      event.preventDefault()
      pinching.current = true
      gestureScale = 1
    }
    const gestureChange = (event: Event) => {
      event.preventDefault()
      const gesture = event as GestureEvent
      onGesture(gesture, gesture.scale / gestureScale)
      gestureScale = gesture.scale
    }
    const gestureEnd = (event: Event) => {
      event.preventDefault()
      pinching.current = false
    }
    // Not passive, so the page itself doesn't scroll or zoom too.
    viewportElement.addEventListener('wheel', wheel, { passive: false })
    viewportElement.addEventListener('gesturestart', gestureStart)
    viewportElement.addEventListener('gesturechange', gestureChange)
    viewportElement.addEventListener('gestureend', gestureEnd)
    return () => {
      viewportElement.removeEventListener('wheel', wheel)
      viewportElement.removeEventListener('gesturestart', gestureStart)
      viewportElement.removeEventListener('gesturechange', gestureChange)
      viewportElement.removeEventListener('gestureend', gestureEnd)
    }
  }, [viewportElement])

  // Where this pane was scrolled to by code rather than by the user, which it
  // doesn't pass on: a pane that can't scroll as far would pull the others
  // back.
  const ignoredScroll = useRef<{ left: number; top: number } | null>(null)
  const scrollTo = (left: number, top: number) => {
    if (!viewportElement) return
    const { scrollLeft, scrollTop } = viewportElement
    viewportElement.scrollLeft = left
    viewportElement.scrollTop = top
    const moved =
      viewportElement.scrollLeft !== scrollLeft ||
      viewportElement.scrollTop !== scrollTop
    ignoredScroll.current = moved
      ? { left: viewportElement.scrollLeft, top: viewportElement.scrollTop }
      : null
  }
  const onSyncedScroll = useEffectEvent(
    (source: string, left: number, top: number) => {
      if (source !== panelId) scrollTo(left, top)
    },
  )

  useEffect(() => {
    if (!viewportElement || !syncZoom) return
    const scroll = () => {
      const { scrollLeft: left, scrollTop: top } = viewportElement
      const ignored = ignoredScroll.current
      ignoredScroll.current = null
      if (ignored?.left === left && ignored.top === top) return
      for (const listener of scrollListeners) listener(panelId, left, top)
    }
    const listener: ScrollListener = (source, left, top) =>
      onSyncedScroll(source, left, top)
    scrollListeners.add(listener)
    viewportElement.addEventListener('scroll', scroll, { passive: true })
    return () => {
      scrollListeners.delete(listener)
      viewportElement.removeEventListener('scroll', scroll)
    }
  }, [viewportElement, syncZoom, panelId])

  // Keeps what was under the pointer there, or else what was in the middle
  // of the pane, as labels grow and shrink. Only the pane being zoomed
  // passes its scroll on; the others follow it.
  const shownScale = useRef(scale)
  useLayoutEffect(() => {
    const previous = shownScale.current
    shownScale.current = scale
    const anchor = pendingZoom.current?.anchor
    pendingZoom.current = null
    if (!viewportElement || previous === scale) return

    if (anchor?.element.isConnected) {
      const box = viewportElement.getBoundingClientRect()
      const rect = anchor.element.getBoundingClientRect()
      viewportElement.scrollLeft +=
        rect.left + anchor.fx * rect.width - box.left - anchor.x
      viewportElement.scrollTop +=
        rect.top + anchor.fy * rect.height - box.top - anchor.y
      return
    }
    const ratio = scale / previous
    const { clientWidth, clientHeight, scrollLeft, scrollTop } = viewportElement
    scrollTo(
      (scrollLeft + clientWidth / 2) * ratio - clientWidth / 2,
      (scrollTop + clientHeight / 2) * ratio - clientHeight / 2,
    )
  }, [scale, viewportElement])
}
