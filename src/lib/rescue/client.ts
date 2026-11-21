import type { RescueApi, RescueLevel, RescueOpenOptions } from './rescue'

// The app's side of the recovery screen that `rescue.ts` installs before the
// app loads. Each call still works, through the console, where it isn't
// installed: on the server and in tests.

declare global {
  interface Window {
    __editorRescue?: RescueApi
  }
}

const rescue = () =>
  typeof window === 'undefined' ? undefined : window.__editorRescue

/** Adds a line to the log the recovery screen shows and sends for help. */
export function logEvent(
  level: RescueLevel,
  message: string,
  detail?: unknown,
) {
  const api = rescue()
  if (api) api.log(level, message, detail)
  else if (detail === undefined) console[level](`[editor] ${message}`)
  else console[level](`[editor] ${message}`, detail)
}

/** Shows the recovery screen. */
export function openRescue(options?: RescueOpenOptions) {
  rescue()?.open(options)
}

/**
 * Hears of errors nothing caught while the app is on screen. The screen
 * leaves showing them to the app as long as one listens.
 */
export function onUncaughtError(listener: (message: string) => void) {
  const handle = (event: Event) => {
    event.preventDefault()
    listener((event as CustomEvent<{ message: string }>).detail.message)
  }
  window.addEventListener('editor:error', handle)
  return () => window.removeEventListener('editor:error', handle)
}
