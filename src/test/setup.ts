import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lays nothing out, so it has no scrolling to do.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
})
