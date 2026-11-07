import { useSyncExternalStore } from 'react'

/** Whether the page is in dark mode, following the `.dark` class on <html>. */
export function useDarkMode() {
  return useSyncExternalStore(
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
}
