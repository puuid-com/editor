import { createContext, useContext, useSyncExternalStore } from 'react'

import { isDark, subscribeTheme } from '#/lib/theme'

/** Set where content is always drawn light, such as a PDF, whatever the page's theme. */
export const LightOnly = createContext(false)

/** Whether the page is in dark mode, following the `.dark` class on <html>. */
export function useDarkMode() {
  const light = useContext(LightOnly)
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false)
  return dark && !light
}
