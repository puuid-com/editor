import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { usePreviewZoom } from './use-preview-zoom'

function viewport() {
  const element = document.createElement('div')
  Object.defineProperties(element, {
    clientWidth: { value: 200 },
    clientHeight: { value: 100 },
    scrollTo: {
      value: vi.fn(({ left, top }: ScrollToOptions) => {
        element.scrollLeft = left ?? element.scrollLeft
        element.scrollTop = top ?? element.scrollTop
      }),
    },
  })
  return element
}

function preview(element: HTMLDivElement, panelId: string) {
  return renderHook(
    ({ scale }) =>
      usePreviewZoom({
        panelId,
        viewportElement: element,
        viewportHeight: 100,
        scale,
        hasLabels: true,
        syncZoom: true,
      }),
    { initialProps: { scale: 1 } },
  )
}

afterEach(() => vi.restoreAllMocks())

describe('preview zoom scrolling', () => {
  it('keeps the viewport center in place when scale changes', () => {
    const element = viewport()
    element.scrollLeft = 100
    element.scrollTop = 50
    const hook = preview(element, 'one')
    hook.rerender({ scale: 2 })
    expect(element.scrollLeft).toBe(300)
    expect(element.scrollTop).toBe(150)
    expect(element.scrollTo).toHaveBeenCalledWith({
      left: 300,
      top: 150,
      behavior: 'instant',
    })
    hook.rerender({ scale: 2 })
    expect(element.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('syncs other previews without echoing a programmatic scroll back', () => {
    const first = viewport()
    const second = viewport()
    preview(first, 'one')
    const other = preview(second, 'two')
    first.scrollLeft = 80
    first.scrollTop = 40
    act(() => first.dispatchEvent(new Event('scroll')))
    expect(second.scrollLeft).toBe(80)
    expect(second.scrollTop).toBe(40)
    act(() => second.dispatchEvent(new Event('scroll')))
    expect(first.scrollTo).not.toHaveBeenCalled()
    other.unmount()
    act(() => first.dispatchEvent(new Event('scroll')))
    expect(second.scrollTo).toHaveBeenCalledTimes(1)
  })
})
