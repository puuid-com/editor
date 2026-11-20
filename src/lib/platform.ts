export const isMac =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)

/** The main modifier key as shown in text. */
export const mod = isMac ? '⌘' : 'Ctrl'
