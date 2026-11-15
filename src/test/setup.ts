import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lays nothing out, so it has no scrolling to do.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView = () => {}
if (typeof window !== 'undefined') window.scrollTo = () => {}
// Nor measures text, which CodeMirror does on a frame that can land after a
// test finishes and throw outside it.
if (typeof Range !== 'undefined') {
  const empty = () => new DOMRect(0, 0, 0, 0)
  Range.prototype.getBoundingClientRect = empty
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null })
}
// Nor sizes to watch, which Radix asks for to place popovers.
if (typeof ResizeObserver === 'undefined')
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

afterEach(() => {
  cleanup()
})
