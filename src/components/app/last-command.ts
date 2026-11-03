const storageKey = 'palette-last-command'

// Storage can be off, as with blocked site data, so failures only cost the
// palette its memory of the last command.

/** The cmdk value of the command last run from the palette, if any. */
export function readLastCommand() {
  try {
    return localStorage.getItem(storageKey) ?? ''
  } catch {
    return ''
  }
}

export function saveLastCommand(value: string) {
  if (!value) return
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Not remembered; the palette opens on its first command next time.
  }
}
