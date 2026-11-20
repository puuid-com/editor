const storageKey = 'palette-last-prefix'

// Storage can be off, as with blocked site data, so failures only cost the
// prefix search its memory of the last prefix.

/** The tag prefix last removed from the palette, as `soap:`, if any. */
export function readLastPrefix() {
  try {
    return localStorage.getItem(storageKey) ?? ''
  } catch {
    return ''
  }
}

export function saveLastPrefix(prefix: string) {
  try {
    localStorage.setItem(storageKey, prefix)
  } catch {
    // Not remembered; the prefix search opens empty next time.
  }
}
