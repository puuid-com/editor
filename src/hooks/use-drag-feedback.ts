import { useEffect, useRef } from 'react'
import type { DragEvent } from 'react'

const targetClasses = [
  'outline',
  'outline-1',
  '-outline-offset-1',
  'outline-foreground/50',
  'bg-muted/60',
]

/** Keep one destination outlined, including while crossing nested rows. */
export function useDragFeedback() {
  const target = useRef<Element | null>(null)
  const source = useRef<Element | null>(null)
  const clearTarget = () => {
    target.current?.classList.remove(...targetClasses)
    target.current = null
  }
  const clear = () => {
    clearTarget()
    source.current?.classList.remove('opacity-40')
    source.current = null
  }
  useEffect(() => {
    document.addEventListener('dragend', clear)
    document.addEventListener('drop', clear)
    return () => {
      document.removeEventListener('dragend', clear)
      document.removeEventListener('drop', clear)
      clear()
    }
  }, [])
  return {
    start: (event: DragEvent<Element>) => {
      clear()
      source.current = event.currentTarget
      source.current.classList.add('opacity-40')
    },
    over: (event: DragEvent<Element>) => {
      if (target.current === event.currentTarget) return
      clearTarget()
      target.current = event.currentTarget
      target.current.classList.add(...targetClasses)
    },
    leave: (event: DragEvent<Element>) => {
      if (event.currentTarget !== target.current) return
      if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      )
        return
      clearTarget()
    },
    clear,
  }
}
