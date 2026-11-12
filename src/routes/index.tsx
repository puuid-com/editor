import { createFileRoute } from '@tanstack/react-router'

import { EditorApp } from '#/components/app/EditorApp'
import { m } from '#/paraglide/messages'
import { site } from '#/site'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  // The editor lives entirely in the browser (CodeMirror, local cache).
  ssr: false,
  // Stored files and settings load from IndexedDB before the editor shows.
  // The workspace is imported here, not at the top: this file is part of
  // every page, and the site's other pages have no use for its database.
  loader: async () => {
    const workspace = await import('#/lib/store/workspace')
    await workspace.workspaceReady()
    return { fileName: workspace.activeFileName() }
  },
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
