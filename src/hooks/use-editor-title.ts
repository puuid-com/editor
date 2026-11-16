import { useEffect } from 'react'

import { site } from '#/site'

/**
 * Writes `text` into the page's title where the router rendered it. Setting
 * `document.title` would swap in a new text node, and the router's next
 * title could go to the old one.
 */
function write(title: HTMLTitleElement, text: string) {
  const node = title.firstChild
  if (node instanceof Text && node === title.lastChild) node.data = text
  else title.textContent = text
}

/**
 * Shows the active file's name in the browser tab, ahead of the site's name.
 *
 * The route's head has the title for every page, but it only changes when
 * the route loads again, which renders the whole editor several times over:
 * too much for a switch of tab. The name goes over the route's title
 * instead, and the route's own comes back when no file is open or the
 * editor is left.
 */
export function useEditorTitle(filename?: string) {
  useEffect(() => {
    if (!filename) return
    const named = `${filename} | ${site.name}`
    /** The route's title, as it was when the name went over it. */
    let own: string | undefined
    const show = () => {
      const title = document.querySelector('title')
      if (!title || title.textContent === named) return
      own = title.textContent
      write(title, named)
    }
    show()
    // The router renders its title again on a change of route or language,
    // in the same element or in a new one: the name goes back over it.
    const observer = new MutationObserver(show)
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    return () => {
      observer.disconnect()
      const title = document.querySelector('title')
      // Unless the page has moved on to a title of its own.
      if (title?.textContent === named && own !== undefined) write(title, own)
    }
  }, [filename])
}
