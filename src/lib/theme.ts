import { recordStep } from './store/history'

const storageKey = 'theme'

// Runs before first paint so the page never flashes the wrong theme.
// Uses the stored choice when there is one, otherwise follows the system
// preference and keeps following it while the page is open.
export const themeScript = `(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const stored = () => {
    try {
      return localStorage.getItem('${storageKey}')
    } catch {
      return null
    }
  }
  const apply = () => {
    const choice = stored()
    const dark = choice ? choice === 'dark' : media.matches
    document.documentElement.classList.toggle('dark', dark)
  }
  apply()
  media.addEventListener('change', apply)
})()`

/** Flips between light and dark and remembers the choice. Undoable. */
export function toggleTheme() {
  flipTheme()
  recordStep({ undo: flipTheme, redo: flipTheme })
}

function flipTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  try {
    localStorage.setItem(storageKey, dark ? 'dark' : 'light')
  } catch {
    // Storage is off; the choice lasts until the page reloads.
  }
}

/** Whether the page is dark right now. */
export function isDark() {
  return document.documentElement.classList.contains('dark')
}

/** Calls `onChange` whenever the page switches between light and dark. */
export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}
