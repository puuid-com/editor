import { PREFERENCES_KEY } from './code-font'

/** The Markdown blocks that can be centered on the page. */
export const centerables = ['table', 'image', 'code', 'mermaid'] as const
export type Centerable = (typeof centerables)[number]

/** Centered unless turned off: diagrams were always drawn in the middle. */
export const defaultCentered: Array<Centerable> = ['mermaid']

/**
 * Set on `<html>` to the centered blocks, space-separated, for the preview,
 * PDF and live preview's CSS to read (`[data-md-center~='table']`).
 */
export const CENTER_ATTRIBUTE = 'data-md-center'

/** Puts `centered` on `<html>`. */
export function applyCentered(centered: ReadonlyArray<Centerable>) {
  document.documentElement.setAttribute(CENTER_ATTRIBUTE, centered.join(' '))
}

// Runs before first paint so blocks never jump into the middle after loading.
export const centerScript = `(() => {
  let centered = ${JSON.stringify(defaultCentered)}
  try {
    const stored = JSON.parse(localStorage.getItem('${PREFERENCES_KEY}'))?.centered
    if (Array.isArray(stored)) centered = stored
  } catch {
    // Storage is off or unreadable; the defaults stay.
  }
  document.documentElement.setAttribute('${CENTER_ATTRIBUTE}', centered.join(' '))
})()`
