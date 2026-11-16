import { createFileRoute } from '@tanstack/react-router'

import { EditorApp } from '#/components/app/EditorApp'
import { editorReady } from '#/components/app/startup'
import { m } from '#/paraglide/messages'
import { site } from '#/site'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  // The editor lives entirely in the browser (CodeMirror, local cache).
  ssr: false,
  // Stored files and settings load from IndexedDB before the editor shows.
  // The loader ships with the component rather than with this file, which
  // is part of every page: the site's other pages have no use for the
  // editor's database.
  codeSplitGroupings: [['loader', 'component']],
  loader: () => editorReady(),
  head: ({ loaderData }) => {
    const metadata = seo({ title: m.seo_title(), path: '/' })
    const name = loaderData?.fileName
    return {
      ...metadata,
      // Only the browser title contains local filenames; social tags stay public.
      meta: metadata.meta.map((meta) =>
        'title' in meta && name ? { title: `${name} | ${site.name}` } : meta,
      ),
    }
  },
  component: EditorApp,
})
