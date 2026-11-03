import { useEffect, useState } from 'react'

/**
 * Whether `ref` can scroll further left or right. Tracks its size and
 * children, and turns vertical wheel scrolling into horizontal.
 */
export function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setEdges((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      )
    }
    // Wheels without a horizontal axis scroll the strip sideways.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(el)
    const children = new MutationObserver(update)
    children.observe(el, { childList: true })
    el.addEventListener('scroll', update, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      resize.disconnect()
      children.disconnect()
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', onWheel)
    }
  }, [ref])

  return edges
}
