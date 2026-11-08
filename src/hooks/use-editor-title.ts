import { useEffect } from 'react'
import { m } from '#/paraglide/messages'
import { site } from '#/site'

/** Local filenames belong only in the browser title, never public share metadata. */
export function useEditorTitle(filename?: string) {
  const title = `${filename || m.seo_title()} | ${site.name}`
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      // A route transition may already have installed the next page's title.
      if (document.title === title) document.title = previous
    }
  }, [title])
}
