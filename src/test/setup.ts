import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lays nothing out, so it has no scrolling to do.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView = () => {}
if (typeof window !== 'undefined') window.scrollTo = () => {}
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
