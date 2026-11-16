import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'

// Parts of the editor that aren't on screen when it opens (a dialog, the
// settings page, the support for a file type) stay out of its first load.
// They are fetched when first asked for, or sooner: once the editor has
// rendered and the browser is idle, so they are usually there by then.

type Load = () => Promise<unknown>

const waiting: Array<Load> = []
/** Loads that failed, to try again once the connection is back. */
const failed = new Set<Load>()
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
    if (!load) return next()
    void load().then(next, () => {
      failed.add(load)
      next()
    })
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

type FailureListener = () => void
const failureListeners = new Set<FailureListener>()
/** Parts on screen that are still waiting for their code. */
const retries = new Set<() => void>()
// One report for a failure, however many parts were waiting on it: they
// all hear of it in the same turn.
let reported = false

/** Calls `listener` when a part that was asked for could not be fetched. */
export function onLoadFailed(listener: FailureListener) {
  failureListeners.add(listener)
  return () => {
    failureListeners.delete(listener)
  }
}

// Asked for again when the connection is back. Some browsers remember that
// a script failed to load and won't fetch it twice in one page, so the
// listeners above are told of a failure either way: a reload always works.
function retryLoads() {
  for (const retry of [...retries]) retry()
  for (const load of failed) waiting.push(load)
  failed.clear()
  schedule()
}

if (typeof window !== 'undefined') window.addEventListener('online', retryLoads)

/**
 * A component fetched when it first renders, and ahead of that once the
 * editor is idle. Nothing shows in its place until it is there. If it can't
 * be fetched, nothing shows either and `onLoadFailed` hears of it, rather
 * than the editor giving way to an error page.
 */
export function lazyPart<TProps extends object>(
  load: () => Promise<ComponentType<TProps>>,
) {
  let Loaded: ComponentType<TProps> | undefined
  const fetch = once(() =>
    load().then((component) => {
      Loaded = component
    }),
  )
  preloadWhenIdle(fetch)

  return function Part(props: TProps) {
    const [, setAttempt] = useState(0)
    useEffect(() => {
      if (Loaded) return
      let mounted = true
      const attempt = () => {
        fetch().then(
          () => {
            retries.delete(attempt)
            if (mounted) setAttempt((count) => count + 1)
          },
          () => {
            if (!mounted || reported) return
            reported = true
            setTimeout(() => {
              reported = false
            })
            for (const listener of failureListeners) listener()
          },
        )
      }
      retries.add(attempt)
      attempt()
      return () => {
        mounted = false
        retries.delete(attempt)
      }
    }, [])
    return Loaded ? <Loaded {...props} /> : null
  }
}
