import { createContext, useContext, useSyncExternalStore } from 'react'

/** Set where content is always drawn light, such as a PDF, whatever the page's theme. */
export const LightOnly = createContext(false)

/** Whether the page is in dark mode, following the `.dark` class on <html>. */
export function useDarkMode() {
  const light = useContext(LightOnly)
  const dark = useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
  return dark && !light
}
