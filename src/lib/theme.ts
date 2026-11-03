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

/** Flips between light and dark and remembers the choice. */
export function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark')
  try {
    localStorage.setItem(storageKey, dark ? 'dark' : 'light')
  } catch {
    // Storage is off; the choice lasts until the page reloads.
  }
}
