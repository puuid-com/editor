import { createFileRoute } from '@tanstack/react-router'

import { EditorApp } from '#/components/app/EditorApp'
import { m } from '#/paraglide/messages'
import { filesCollection } from '#/lib/store/files'
import { sessionStore } from '#/lib/store/session'
import { site } from '#/site'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  // The editor lives entirely in the browser (CodeMirror, local cache).
  ssr: false,
  // Stored files and settings load from IndexedDB before the editor shows.
  loader: () =>
    import('#/lib/store/workspace').then((mod) => mod.workspaceReady()),
  head: () => {
    const metadata = seo({ title: m.seo_title(), path: '/' })
    const activeId = sessionStore.state.activeId
    const file = activeId ? filesCollection.get(activeId) : undefined
    const name = file?.deletedAt === null ? file.name : undefined
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
