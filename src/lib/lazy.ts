import { lazy } from 'react'
import type { ComponentType } from 'react'

// Parts of the editor that aren't on screen when it opens (a dialog, the
// settings page, the support for a file type) stay out of its first load.
// They are fetched when first asked for, or sooner: once the editor has
// rendered and the browser is idle, so they are usually there by then.

type Load = () => Promise<unknown>

const waiting: Array<Load> = []
let started = false
let scheduled = false

function whenIdle(run: () => void) {
  // Safari has no requestIdleCallback.
  if (typeof requestIdleCallback === 'function')
    requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 300)
}

/** Fetches what is waiting one part at a time, so no idle period runs long. */
function schedule() {
  if (scheduled || !started || waiting.length === 0) return
  scheduled = true
  whenIdle(() => {
    const load = waiting.shift()
    const next = () => {
      scheduled = false
      schedule()
    }
    // A part that can't be fetched now is fetched when it is asked for.
    if (load) void load().then(next, next)
    else next()
  })
}

/** Has `load` run once the editor is idle, after `startPreloading`. */
export function preloadWhenIdle(load: Load) {
  if (typeof window === 'undefined') return
  waiting.push(load)
  schedule()
}

/** Starts fetching the parts left out of the first load. Call once it has rendered. */
export function startPreloading() {
  started = true
  schedule()
}

/**
 * `load` made to run once however often it is asked for. A failed load, when
 * offline say, is forgotten, so asking again tries again.
 */
export function once<T>(load: () => Promise<T>) {
  let loading: Promise<T> | undefined
  return () =>
    (loading ??= load().catch((error: unknown) => {
      loading = undefined
      throw error
    }))
}

/**
 * A component fetched when it first renders, like React's `lazy`, and ahead
 * of that once the editor is idle. Render it inside a `Suspense`.
 */
export function lazyPart<TProps>(load: () => Promise<ComponentType<TProps>>) {
  const fetch = once(() => load().then((component) => ({ default: component })))
  preloadWhenIdle(fetch)
  return lazy(fetch)
}
